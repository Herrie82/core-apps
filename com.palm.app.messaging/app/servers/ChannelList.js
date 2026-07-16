/*globals enyo */

// The channel (room) list for one server, shown after drilling into a server row. Going back up is
// handled by the app's bottom Toolbar (see ServerList/Messaging), so this view has no back button of
// its own - just a search box and the channel list. Selecting a channel resolves its
// imchannel.chatThreadId to the chatthread record and emits it upward via onSelectThread, reusing
// the exact thread-selection contract ThreadList uses so the right-hand ChatView opens the channel
// conversation with no new plumbing.
enyo.kind({
	name: "ChannelList",
	kind: "VFlexBox",
	events: {
		onSelectThread: ""
	},
	published: {
		serverId: ""
	},
	components: [
		{kind: "ChannelService", onSuccess: "gotChannels", onWatch: "channelsWatch"},
		{name: "search", kind: "SearchInput", hint: $L("Search channels"), className: "enyo-middle", onchange: "filterList", onCancel: "filterList", changeOnInput: true, autoCapitalize: "lowercase"},
		{className: "header-shadow header-app-shadow"},
		{name: "emptyMessage", content: "", className: "messageTexts", showing: false},
		{flex: 1, name: "list", kind: "DbList", desc: false, onQuery: "listQuery", className: "messaging-listsDivider", onSetupRow: "listSetupRow", components: [
			{name: "channelItem", kind: "ChannelItem", tapHighlight: true, onclick: "selectChannel"}
		]},
		{kind: "DbService", dbKind: "com.palm.chatthread:1", components: [
			{name: "threadGetter", method: "get", onSuccess: "threadFetched", onFailure: "threadFetchFailed"}
		]},
		{name: "mockThreadGetter", kind: "ServersMockDb", dbKind: "serverchannels_threads/com.palm.chatthread:1", method: "get", onSuccess: "threadFetched", onFailure: "threadFetchFailed"}
	],
	initComponents: function() {
		this.inherited(arguments);
		if (!window.PalmSystem) {
			this.$.threadGetter = this.$.mockThreadGetter;
		}
	},
	// Point this list at a server: stash its id, retarget the search hint, and re-run the query.
	setServer: function(inServer) {
		this.serverId = inServer && inServer._id;
		this.serverName = (inServer && (inServer.displayName || inServer.name)) || $L("channels");
		this.$.search.setHint($L("Search ") + this.serverName);
		this.filterString = "";
		this.$.search.setValue("");
		this.$.list.reset();
	},
	channelsWatch: function() {
		this.$.list.reset();
	},
	filterList: function() {
		this.filterString = this.$.search.getValue();
		this.$.list.punt();
	},
	listQuery: function(inSender, inQuery) {
		if (!this.serverId) {
			// No server drilled into yet - don't hit the db; the list stays empty until setServer().
			return undefined;
		}
		inQuery.where = [{prop: "serverId", op: "=", val: this.serverId}];
		inQuery.orderBy = "position";
		return this.$.channelService.call({query: inQuery});
	},
	gotChannels: function(inSender, inResponse, inRequest) {
		inResponse = this.applyFilter(inResponse, ["name", "displayName", "remoteId"]);
		this.$.list.queryResponse(inResponse, inRequest);
		if ((inRequest.index === 0) && (!inResponse.results || inResponse.results.length === 0)) {
			this.$.emptyMessage.setContent(this.filterString ? $L("No channels match your search.") : $L("No channels yet."));
			this.$.emptyMessage.show();
		} else {
			this.$.emptyMessage.hide();
		}
	},
	applyFilter: function(inResponse, fields) {
		if (!this.filterString || !inResponse || !inResponse.results) {
			return inResponse;
		}
		var f = this.filterString.toLowerCase();
		var out = inResponse.results.filter(function(r) {
			return fields.some(function(k) { return r[k] && String(r[k]).toLowerCase().indexOf(f) !== -1; });
		});
		return {returnValue: inResponse.returnValue, results: out};
	},
	listSetupRow: function(inSender, inChannel, inIndex) {
		this.$.channelItem.setChannel(inChannel);
		var selected = (this.selectedRecord && this.selectedRecord._id === inChannel._id) ||
			(this.selectedChatThread && inChannel.chatThreadId && this.selectedChatThread._id === inChannel.chatThreadId);
		this.$.channelItem.addRemoveClass("enyo-item-selected", selected ? true : false);
	},
	selectChannel: function(inSender, inEvent) {
		var record = this.$.list.fetch(inEvent.rowIndex);
		if (!record) {
			return;
		}
		this.selectedRecord = record;
		this.$.list.refresh();
		if (record.chatThreadId) {
			// Resolve the channel's chatthread (created by the chatthreader on the channel's first
			// message) and hand it up exactly like a thread selection.
			this.$.threadGetter.call({ids: [record.chatThreadId]});
		} else {
			// No conversation yet (channel seen but no message threaded). Nothing to open.
			enyo.warn("ChannelList: channel " + record._id + " has no chatThreadId yet");
		}
	},
	threadFetched: function(inSender, inResponse) {
		if (inResponse.results && inResponse.results.length > 0) {
			this.doSelectThread(inResponse.results[0]);
		}
	},
	threadFetchFailed: function(inSender, inResponse) {
		enyo.error("ChannelList: failed to fetch channel chatthread: ", inResponse);
	},
	updateList: function() {
		this.$.list.update();
	},
	resetList: function() {
		this.$.list.reset();
	},
	setSelection: function(inChatThread) {
		// Highlight the channel whose chatthread is now the active conversation.
		this.selectedChatThread = inChatThread;
		this.$.list.refresh();
	}
});
