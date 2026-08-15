/**
	Wish list:
	* Add persistent mru support
*/
enyo.kind({
	name: "VideoAddressingList",
	kind: enyo.VFlexBox,
	flex: 1,
	published: {
		/* Address types as defined by the contacts schema that should be
		 * returned for each contact.
		 *
		 * Options are one or more of "emails", "phoneNumbers", and "ims"
		 */
		addressTypes: null,
		imTypes: null,
		selected: null,
		showVideo: false
	},
	events: {
		/**
		Event fires when an address is selected; in addition to inSender, fires with:
		
		inDisplayAddress {Object} The selected address 

		inAddress {Object} The contact record for the selected address
		*/
		onSelect: "",
		onVideoCall: "",
		onSetupHeader: ""
	},
	filterHighlightClassName: "enyo-text-filter-highlight",
	//* @protected
	components: [
		//{kind: "DbPages", onQuery: "dbPagesQuery", onReceive: "receiveDbPage", size: 20},

		//favorites
		{kind: "DbService", dbKind: "com.palm.person:1", name: "findTempDB", method: "find", onSuccess: "gotTempDBFavSearchResults", onFailure: "gotFailure", subcribe: true, onWatch: "watchfavoritesChange"},

		// webOS: presence + search for the VIDEO tab, generalized off the same POLYMORPHIC base kind
		// (com.palm.imbuddystatus:1) every current connector (WhatsApp/Signal/Telegram/Teams/Discord/
		// Google Chat/...) already publishes into - com.palm.app.messaging reads this same kind for
		// its own buddy list. Replaces the old Skype-only imbuddystatus.skypem query (dead since
		// Skype's backend was removed - "kind not registered" on every open) - filtered at query time
		// to CallSynergizer.getVideoCallableImTypes() (accounts whose PHONE capabilityProvider
		// declares a videoFormat) so this only ever lists services that can actually take a video
		// call, same one-agnostic-place pattern as getCallableImTypes()/Dialer.js already use for
		// voice. This ALSO supersedes the old gotOtherImContacts fallback (which listed every
		// contact-point unconditionally, with no presence and no search) - real presence + search
		// now covers every video-capable service, not just Skype.
		{kind: enyo.TempDbService, dbKind: "com.palm.imbuddystatus:1", onSuccess: "querySuccess", onFailure: "gotFailure", components: [
			{name: "find", method: "find", onSuccess: "VCgotBuddies"},
			// webOS: "find" not "search" - Enyo's DbService routes both through the identical
			// findOrSearch() query-builder (see framework source), so the LS2 method name is the
			// only difference; db8's "search" appears to require a tokenized index (db8.md only
			// documents "find" at all) and this kind has no tokenize:"all" on username, unlike
			// whatever index Skype's own now-gone kind apparently had - "search" here silently
			// returned zero rows. "find" with the same %-prefix where-clause works (proven by the
			// unfiltered list query above using find successfully).
			{name: "search", method: "find", onSuccess: "VCgotBuddies"},
			{name: "get", method: "get"}
		]},
		//{kind: "GalService", onSuccess: "gotGalResults", onFailure: "gotFailure"},
		{name: "list", flex: 1, kind: "VirtualList",
			/*onAcquirePage: "listAcquirePage", onDiscardPage: "listDiscardPage",*/ onSetupRow: "listSetupRow", pageSize: 20, components: [
			{name: "client", canGenerate: false},
			{kind: "Divider", allowHtml: true},
			{name: "addressList", kind: "VirtualRepeater", onSetupRow: "addressGetItem", components: [
				{kind: "Item", tapHighlight: true, onclick: "selectItem", components: [	 
				 	{layoutKind: "HFlexLayout", components: [
                                                {name: "address", className: "enyo-addressing-address enyo-addressing-padding"},
                                                {name: "status", className: "enyo-addressing-address enyo-addressing-padding"},
                                                {kind: "Spacer"},
						{flex: 0, pack: "end", components: [
							{name: "videoEnabledIcon", className: "enyo-addressing-videoOnline", onclick: "videoButtonClick"},
							{name: "addressType", className: "enyo-addressing-type enyo-addressing-padding enyo-label"},
						]}
					]}
				]}
			]}
		]},
		{name:"noResultsMessage", kind:"VFlexBox", showing:false, flex:1, components:[
			{kind:"Spacer"},
			{content:$L("No search results found"), flex:1, className:"enyo-addressing-noresults"},
		]},
		{kind:"HFlexBox", name:"GalMessage", className:"enyo-addressing-GAL", showing:false, components:[
			{content:$L("Global Address Search"), className:"enyo-addressing-GAL-message enyo-addressing-GAL-padding"},
			{kind:"Spacer"},
			{name:"GalSpinner", kind:"Spinner", className:"enyo-addressing-GAL-spinner enyo-addressing-GAL-padding"}
		]},
		
		{name: "dbBuddiesVC", kind: enyo.TempDbService, dbKind: "com.palm.imbuddystatus:1", method: "find", subscribe: false, onSuccess: "VCgotBuddies"},
	],
	favoriteHtml: '<div class="enyo-addressing-favorite"></div>',
	create: function() {
		this.inherited(arguments);

		this.data = [];
		if (!this.addressTypes) {
			this.addressTypes = ["emails"];
		}
		// FIXME: see fixme at "listRowToPage"
		//this.$.list.rowToPage = enyo.bind(this, "listRowToPage");
		this.addressTypesChanged();

		//Get favorites from database
		this.tempDBFavdata = [];
		var query = {
			from: "com.palm.person:1",
			orderBy: "sortKey",
			desc: false,
			select: ["_id", "favorite", "ims"],
			where: [{prop: "favorite", op: "=", val: true}],
		}
		this.$.findTempDB.call({query: query});

		//subscribe to buddy availability status change (live presence across every connector)
		this.tempdbContacts = [];
		this._updateBuddyStatusAddressing = enyo.hitch(this, "updateBuddyStatusAddressing");
		if (enyo.application.Cache.imBuddyStatusCache) {
			enyo.application.Cache.imBuddyStatusCache.registerBuddyStatus(this._updateBuddyStatusAddressing);
		}

		//Get video-capable buddies now
		//this.$.dbBuddiesVC.call();

	},
	destroy: function () {

		//this.$.dbBuddiesVC.cancel();

		if(enyo.application.Cache.imBuddyStatusCache) {
			enyo.application.Cache.imBuddyStatusCache.unregisterBuddyStatus(this._updateBuddyStatusAddressing);
		}
		this.cancelSearch();
				
		this.inherited(arguments);
	},
	watchfavoritesChange: function() {
		//dont do anything here 
	},
	gotTempDBFavSearchResults: function(inSender, inResponse) {
		this.tempDBFavdata = (inResponse && inResponse.results) || [];
		this.updateBuddyStatusAddressing();
	},
	// Provider-agnostic: match by username across any IM type (whatsapp/telegram/signal/teams/skype/...),
	// not just type_skype - so favorites work the same for every video-capable transport.
	getFavoriteFromUsername: function(username) {
		for (var i = 0; i < this.tempDBFavdata.length; i++) {
			for (var j = 0; j < this.tempDBFavdata[i].ims.length; j++) {
				if(this.tempDBFavdata[i].ims[j].value == username) {
					return true;
				}
			}
		}
		return false;
	},
	// webOS: always the same unfiltered fetch, whether or not the user is typing a search string -
	// see VCgotBuddies for why (search-string filtering moved client-side).
	updateBuddyStatusAddressing: function () {
		this.$.dbBuddiesVC.call();
	},
	// webOS: buddy.availability is the live per-connector presence enum (0 online/available,
	// 2 busy, 4 offline - same numeric convention com.palm.app.messaging's BuddyItem.js already
	// uses for every service). Skype wrote its own personAvailability field with the same numbers;
	// prefer it if present so nothing regresses if a future connector ever writes it too.
	//
	// Video-capable-service filtering happens HERE (client-side), not in the db8 query: db8's "="
	// operator has no IN/array-match (see knowledge/db8.md's operator table - just =, comparisons,
	// !=, % prefix, ? full-text), and serviceName isn't even a leading prop of any index on this
	// kind on its own (byusername is [username, serviceName] - db8 only supports filtering on an
	// index's leading prefix). Matches the original Skype-only design too, which fetched its
	// (single-service) kind unfiltered and filtered in JS.
	//
	// Search-string filtering ALSO happens here now, not as a separate db8 query: the original
	// (and the first attempt at generalizing it) filtered on username via op:"%", but username is a
	// PHONE NUMBER for WhatsApp/Signal/Telegram - typing a contact's name would never match it, and
	// separately db8's "search" method (vs "find") returned zero rows here regardless (db8.md only
	// documents "find"; this kind has no tokenize:"all" on username for "search" to use). Simplest
	// correct fix: reuse the same broad, proven-working find() and substring-match displayName OR
	// username client-side.
	VCgotBuddies: function(inSender, inResponse, inRequest) {

		var contactsData = (inResponse && inResponse.results) || [];
		var videoTypes = enyo.application.CallSynergizer.getVideoCallableImTypes();
		var searchTerm = this.isFiltering ? this.searchString : "";

		var itemsArrayFav = [];
		var itemsArraynonFav = [];
		if (contactsData && contactsData.length > 0) {
			var buddiesTotal = contactsData.length;
			for (var i = 0; i < buddiesTotal; i++) {
				var b = contactsData[i];
				if (videoTypes.indexOf(b.serviceName) === -1) { continue; }
				var availability = b.personAvailability !== undefined ? b.personAvailability : b.availability;
				if (availability === 4) { continue; } // offline
				if (searchTerm) {
					var hay = ((b.displayName || "") + " " + (b.username || "")).toLowerCase();
					if (hay.indexOf(searchTerm) === -1) { continue; }
				}
				b.favorite = this.getFavoriteFromUsername(b.username);
				b.displayAddresses = [{
					"type": b.serviceName,
					"label": b.serviceName ? b.serviceName.replace("type_", "") : "",
					"formattedValue": b.username,
					"value": b.username
				}];
				(b.favorite ? itemsArrayFav : itemsArraynonFav).push(b);
			}
		}
		this.tempdbContacts = itemsArrayFav.concat(itemsArraynonFav);
		this.toggleNoResults(this.tempdbContacts.length);
		this.$.list.refresh();
	},
	addressTypesChanged: function() {
		this.querySelect =
			[
				"_id",
				"personId",
				"displayName",
				"serviceName",
				"availability",
				"personAvailability",
				"username"
			];
	},
	updateSelection: function(inEvent) {
		var i = this.$.list.fetchRowIndex();
		var vi = inEvent.rowIndex;
		var r = this.fetchRow(i);
		this.setSelected({personId: r.personId, address: {value: r.username, type:r.serviceName}});
	},
	refresh: function() {
		this.$.list.refresh();
	},
	selectItem: function(inSender, inEvent) {
		// user selection so not default.
		this.defaultSelection = false;
		this.updateSelection(inEvent);
		var s = this.getSelected();
		if (s) {
			this.doSelect(s);
		}
		this.refresh();
	},
	videoButtonClick: function(inSender, inEvent){
		this.defaultSelection = false;
		this.updateSelection(inEvent);
		var s = this.getSelected();
		if (s){
			this.doVideoCall(s);
		}
		this.refresh();
	}, 
	editContact: function(inSender, inContact) {
		this.$.get.call({
			ids: [inContact.contactId]
		});
	},
	//* @public
	/** 
	Initiate a address search. 
	First, we query for favorites because they should always be shown at the top of the list.
	Then if inSearch is specified we do an un-paged filter search for up to 200 local contacts and 
	add up to 100 gal contacts per account.
	If inSearch is not specified, we do a paged search for all local contacts.
	*/
	search: function(inSearch) {
		this.cancelSearch();
		this.isFiltering = this.searchString = inSearch.toLowerCase() || "";
		this.updateBuddyStatusAddressing();
	},
	cancelSearch: function() {
		this.data = [];
		this.setSelected(null);
		this.defaultSelection = true;
		this.$.find.cancel();
		this.$.search.cancel();
		//this.$.galService.cancel();
		this.showGalSpinner(false);
	},
	//* @protected
	showGalSpinner: function(inShowing){
		// always hide noResults, because we don't know if the message is real yet
		this.$.noResultsMessage.hide();
		this.$.GalMessage.setShowing(inShowing);
		this.$.GalSpinner.setShowing(inShowing);
		this.$.list.resized();
	},
	gotSearchResults: function(inSender, inResponse, inRequest) {
		this.showGalSpinner(false);
		this.data = this.data.concat(inResponse.results);
		enyo.log("debug-and-remove: data length "+this.data.length);
		//if (this.sortbyStatus) {
			//this.sortbyStatus();
		//}
		this.toggleNoResults(this.data.length)
		this.$.list.refresh();
	},
	/*sortbyStatus: function(){
		var online = [];
		var offline = []; 
		
		for (var i = 0; i<this.data.length; i++){
			var d = this.data[i];
			if (d) {
				enyo.addressing.appendContactDisplayAddresses(d, this.addressTypes, this.imTypes, this.searchString);
				var bShow = false;
				
				if (d.displayAddresses && d.displayAddresses.length) {
					//enyo.log("debug-and-remove: d.displayAddresses.length "+d.displayAddresses.length);
					for (var i = 0; i < d.displayAddresses.length; i++) {
						var itemAddress = d.displayAddresses[i];
						if (itemAddress && itemAddress.type === this.imTypes[0]  && enyo.application.Cache.skypeBuddyCache) {
							//enyo.log("debug-and-remove1: skype contact " + itemAddress.value);
							var buddy = enyo.application.Cache.skypeBuddyCache.getBuddyInfoFromUsername(itemAddress.value);
							if (buddy) {
								//enyo.log("debug-and-remove1: skype buddy username " + buddy.username);
								if (buddy.personAvailability == 0 ||  buddy.personAvailability == 2) {
									online[online.length] = this.data[i]; 
									//enyo.log("debug-and-remove: buddy online " + itemAddress.value);
									
								} else {
									offline[offline.length] = this.data[i]; 
									if (buddy.hasVideoCapability === true) {
										offline[offline.length].video = true;
									}									
									//enyo.log("debug-and-remove: buddy offline " + itemAddress.value);
								}
							}
						} else {
							enyo.log("debug-and-remove: what is the type of ims "+itemAddress.type);
						}
					}
				}
			}			
		}
		if (online.length !== 0){
			this.sortresults(online);
		}
		if (offline.length !== 0){
			this.sortresults(offline); 
		}
		this.data = online.concat(offline); 
	},
	sortresults: function(data) {
		var sortable = [];
		data.forEach(function(a) {
			var va = a.displayName ? a : enyo.addressing.generateDisplayName(a);
			sortable[va] = a; 
		});
		data.sort(function(a, b) {
			var an = a.displayName ? a : enyo.addressing.generateDisplayName(a);
			var bn = b.displayName ? b : enyo.addressing.generateDisplayName(b);
			
			var va = an.displayName, vb = bn.displayName;
			return sortable[vb] - sortable[va];
		});
	}, 

	gotGalResults: function(inSender, inResponse) {
		this.showGalSpinner(false);
		this.data = this.data.concat(inResponse.results);
		this.toggleNoResults(this.data.length)
	},*/
	toggleNoResults: function(inResults) {
		//enyo.log("debug-and-remove: toggle "+inResults);
		if (inResults) {
			this.$.noResultsMessage.hide();
			this.$.list.show();
		} else {
			this.$.noResultsMessage.show();
			this.$.list.hide()
		}
		this.$.list.resized();
	},
	gotFailure: function(inSender, inResponse) {
		this.showGalSpinner(false);
		enyo.error("Contact lookup failed: ", (inResponse && inResponse.errorText));
	},
	// list paging query/response
	dbPagesQuery: function(inSender, inQuery) {		
		inQuery.select = this.querySelect;
		inQuery.orderBy = "sortKey";
		inQuery.where = [{prop: "favorite", op: "=", val: false}];
		return this.$.find.call({
			query: inQuery
		});
	},
	gotPageResults: function(inSender, inResponse, inRequest) {
		//enyo.log("debug-and-remove: gotPageResults "+enyo.json.stringify(inResponse)+ " inRequest ");
		this.$.dbPages.queryResponse(inResponse, inRequest);
		this.$.list.refresh();
	},
	// FIXME: VirtualList could expose an api for this...
	// since paged list contains non-paged data, we need to adjust
	// the calculation of rowToPage
	listRowToPage: function(inRowIndex) {
		//enyo.log("debug-and-remove: listRowToPage "+inRowIndex + " data length "+ this.data.length);
		var pageIndex = Math.floor((inRowIndex - this.data.length) / this.$.list.pageSize);
		return pageIndex;
	},
	listAcquirePage: function(inSender, inPage) {
		//enyo.log("debug-and-remove: listAcquirePage "+inPage);
		if (this.allowListPaging) {
			this.$.dbPages.require(inPage);
		}
	},
	listDiscardPage: function(inSender, inPage) {
		//enyo.log("debug-and-remove: listDiscardPage "+inPage);
		if (this.allowListPaging) {
			this.$.dbPages.dispose(inPage);
		}
	},
	// data processing for list
	fetchRow: function(inIndex) {
		enyo.log("debug-and-remove: fetchRow db total "+this.tempdbContacts.length);
		if (inIndex < this.tempdbContacts.length) {
			return this.tempdbContacts[inIndex];
		} 
		return null; 
	},
	listSetupRow: function(inSender, inIndex) {
	
		if(!this.tempdbContacts || inIndex < 0 || inIndex > this.tempdbContacts.length) {
			return;
		}
		
		var d = this.tempdbContacts[inIndex];
		
		//enyo.error("&&&&&&&&&&&&&&&&&&&&&& video addressing listSetupRowTempDb :" + enyo.json.stringify(d));
		var showHeader = Boolean(this.isFiltering && inIndex == 0);
		this.$.client.canGenerate = showHeader;
		
		if (d) {
			this.repeaterPerson = d;
			// if there's more than one address, show a divider
			if (d.displayAddresses && d.displayAddresses.length){
				var dn = d.displayName;
				this.$.addressList.canGenerate = true;
				this.$.divider.canGenerate = true;
				this.$.divider.show();
				dn = enyo.string.removeHtml(dn).unescapeHTML(); 
				if (this.searchString) {
					dn = enyo.string.applyFilterHighlight(enyo.string.escapeHtml(dn), this.searchString, this.filterHighlightClassName);
				}
				if (d.favorite) {
					dn += this.favoriteHtml;
				}
				//enyo.log("Divider Caption = " + dn);
				this.$.divider.setCaption(dn);
				// setup selection
				if (!this.selected && this.isFiltering) {
					this.selected = {personId: d.personId, address: {value: d.username, type:d.serviceName}};
				}
			} else {				
				this.$.addressList.canGenerate = false;
				this.$.divider.canGenerate = false;
				this.$.divider.hide();
			}
			return true;
		}
		return showHeader;
	
	},

	addressGetItem: function(inSender, inIndex) {
		if(!this.repeaterPerson) {
			return;
		}
		var displayAddresses = this.repeaterPerson.displayAddresses;
		var itemAddress = displayAddresses[inIndex];
		//enyo.error(inIndex + " Row address =  " + enyo.json.stringify(itemAddress));
		if (itemAddress) {
			var s = inIndex == 0 ? "border-top: 0;" : "";
			s += (inIndex == displayAddresses.length-1 ? "border-bottom: 0;" : "");
			this.$.item.addStyles(s);
			this.$.item.addRemoveClass("enyo-addressing-item-selected", 
			this.selected && (this.repeaterPerson == this.selected.person) && (itemAddress == this.selected.address));
								
			//enyo.log("address.formattedValue = " + itemAddress.formattedValue + "; address.label = " + itemAddress.label);
			this.$.videoEnabledIcon.show();
			this.$.address.setContent(itemAddress.formattedValue);
			this.$.addressType.setContent(itemAddress.label);
			// webOS: every row here now comes from the live buddy-status query (VCgotBuddies),
			// already restricted to video-capable services - so this is unconditional, not
			// type_skype-gated like it used to be.
			{
				var availability = this.repeaterPerson.personAvailability !== undefined ? this.repeaterPerson.personAvailability : this.repeaterPerson.availability;
				statusStr = "";
				var color = "#888";
				if (availability == 0) { // online
					statusStr = "(" + $L("Available") + ")";
					color = "#7FBB55";

				}else if (availability == 2) { // busy
					statusStr = "(" + $L("Busy") + ")";
					color = "#AAA";

				} else if (availability == 4) { // offline
					statusStr = "(" + $L("Offline") + ")";

				}

				this.$.status.setContent(statusStr);
				this.$.status.applyStyle('color', color);
			}

			return true;
		}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           
	}
});

String.prototype.unescapeHTML = function() {
	return this.replace(/&amp;/g,'&');//.replace(/&lt;/g,'<').replace(/&gt;/g,'>');
};
