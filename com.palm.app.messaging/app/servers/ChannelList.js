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
			{name: "threadGetter", method: "get", onSuccess: "threadFetched", onFailure: "threadFetchFailed"},
			{name: "threadPutter", method: "put", onSuccess: "threadCreated", onFailure: "threadFetchFailed"}
		]},
		// create-thread-on-tap: link a freshly-created channel thread back onto its imchannel.
		{name: "channelMerger", kind: "DbService", dbKind: "com.palm.db", method: "merge"},
		// join-on-open: ask the transport to join the channel so the prpl fetches its history.
		{name: "channelOpener", kind: "PalmService", service: "palm://com.palm.imlibpurple/", method: "openChannel"},
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
		// join-on-open: fetch this channel's history via the transport (idempotent if already joined).
		if (record.serviceName && record.remoteId) {
			this.$.channelOpener.call({serviceName: record.serviceName, channel: record.remoteId});
		}
		if (record.chatThreadId) {
			// Resolve the channel's chatthread (created by the chatthreader on the channel's first
			// message) and hand it up exactly like a thread selection.
			this.$.threadGetter.call({ids: [record.chatThreadId]});
		} else {
			// create-thread-on-tap: an enumerated channel with no messages yet has no chatthread.
			// Create one now - the same shape the chatthreader uses on a channel's first message
			// (replyAddress = the channel key, channelId/serverId denormalized) - then link it onto
			// the imchannel and open it. A later real message re-uses this same thread via the
			// imchannel.chatThreadId link (findOrCreateChannelThread), so no duplicate is created.
			this.pendingChannel = record;
			var thread = {
				_kind: "com.palm.chatthread:1",
				timestamp: (new Date()).getTime(),
				summary: "",
				flags: { visible: true, outgoing: false },
				displayName: record.displayName || record.name || record.remoteId,
				replyAddress: record.remoteId,
				normalizedAddress: enyo.messaging.utils.normalizeAddress(record.remoteId, record.serviceName),
				replyService: record.serviceName,
				channelId: record._id,
				serverId: record.serverId
			};
			this.$.threadPutter.call({objects: [thread]});
		}
	},
	threadCreated: function(inSender, inResponse) {
		var newId = inResponse && inResponse.results && inResponse.results[0] && inResponse.results[0].id;
		if (!newId || !this.pendingChannel) {
			return;
		}
		// link the new thread onto the imchannel so future messages + re-taps reuse it
		this.$.channelMerger.call({objects: [{_kind: "com.palm.imchannel:1", _id: this.pendingChannel._id, chatThreadId: newId}]});
		this.pendingChannel = null;
		// fetch the canonical thread record and open it (reuses threadFetched -> doSelectThread)
		this.$.threadGetter.call({ids: [newId]});
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
