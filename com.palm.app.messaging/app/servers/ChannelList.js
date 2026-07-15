/*globals enyo */

// The channel (room) list for one server, shown after drilling into a server row. Carries a "back"
// header (there is no built-in breadcrumb in this Enyo build) and a DbList of the server's channels
// queried by serverId. Selecting a channel resolves its imchannel.chatThreadId to the chatthread
// record and emits it upward via onSelectThread, reusing the exact thread-selection contract that
// ThreadList uses - so the right-hand ChatView opens the channel conversation with no new plumbing.
enyo.kind({
	name: "ChannelList",
	kind: "VFlexBox",
	events: {
		onSelectThread: "",
		onBack: ""
	},
	published: {
		serverId: ""
	},
	components: [
		{kind: "ChannelService", onSuccess: "gotChannels", onWatch: "channelsWatch"},
		{kind: "Toolbar", className: "enyo-toolbar-light", components: [
			{kind: "Button", className: "server-back-button", content: "&#9666;", allowHtml: true, onclick: "backClicked"},
			{name: "serverTitle", flex: 1, className: "server-title", content: ""}
		]},
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
	// Point this list at a server: stash its id + title and re-run the DbList query.
	setServer: function(inServer) {
		this.serverId = inServer && inServer._id;
		this.$.serverTitle.setContent(enyo.string.escapeHtml((inServer && (inServer.displayName || inServer.name)) || $L("Channels")));
		this.$.list.reset();
	},
	backClicked: function() {
		this.doBack();
	},
	channelsWatch: function() {
		this.$.list.reset();
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
		this.$.list.queryResponse(inResponse, inRequest);
		if ((inRequest.index === 0) && (!inResponse || !inResponse.results || inResponse.results.length === 0)) {
			this.$.emptyMessage.setContent($L("No channels yet."));
			this.$.emptyMessage.show();
		} else {
			this.$.emptyMessage.hide();
		}
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
