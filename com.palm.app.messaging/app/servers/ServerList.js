/*globals enyo */

// Servers/Rooms (Milestone 2) tab host. Lives at tab index 3 of the left panel's TabGroup+Pane
// (see app/Messaging.js). Presents a two-level drill-down inside its own inner Pane - a server
// (guild/network) list, and, once a server is tapped, that server's channel list - mirroring how
// ChatView (also a Pane) swaps sub-views by name. Selecting a channel bubbles the channel's
// chatthread up via onSelectThread, the same contract ThreadList uses, so MessagingApp opens it in
// the right-hand ChatView with no additional wiring.
enyo.kind({
	name: "ServerList",
	kind: "VFlexBox",
	events: {
		onSelectThread: ""
	},
	components: [
		{kind: "ServerService", onSuccess: "gotServers", onWatch: "serversWatch"},
		{kind: "Pane", flex: 1, name: "drill", transitionKind: "enyo.transitions.LeftRightFlyin", components: [
			{name: "serversView", kind: "VFlexBox", flex: 1, components: [
				{className: "header-shadow header-app-shadow"},
				{name: "emptyMessage", content: "", className: "messageTexts", showing: false},
				{flex: 1, name: "list", kind: "DbList", desc: false, onQuery: "listQuery", className: "messaging-listsDivider", onSetupRow: "listSetupRow", components: [
					{name: "serverItem", kind: "ServerItem", tapHighlight: true, onclick: "selectServer"}
				]}
			]},
			{name: "channelsView", kind: "ChannelList", onSelectThread: "relaySelectThread", onBack: "showServers"}
		]}
	],
	create: function() {
		this.inherited(arguments);
		// Start on the server list; the channel view is shown only after a drill-down.
		this.$.drill.selectViewByIndex(0);
	},
	serversWatch: function() {
		this.$.list.reset();
	},
	listQuery: function(inSender, inQuery) {
		// No where-clause: show every server, ordered by account type (byservice index).
		inQuery.orderBy = "serviceName";
		return this.$.serverService.call({query: inQuery});
	},
	gotServers: function(inSender, inResponse, inRequest) {
		this.$.list.queryResponse(inResponse, inRequest);
		if ((inRequest.index === 0) && (!inResponse || !inResponse.results || inResponse.results.length === 0)) {
			this.$.emptyMessage.setContent($L("No servers yet. Add a Discord, IRC, Teams, Slack or Matrix account to see its servers here."));
			this.$.emptyMessage.show();
		} else {
			this.$.emptyMessage.hide();
		}
	},
	listSetupRow: function(inSender, inServer, inIndex) {
		this.$.serverItem.setServer(inServer);
		this.$.serverItem.addRemoveClass("enyo-item-selected", this.selectedServer && this.selectedServer._id === inServer._id ? true : false);
	},
	selectServer: function(inSender, inEvent) {
		var record = this.$.list.fetch(inEvent.rowIndex);
		if (!record) {
			return;
		}
		this.selectedServer = record;
		this.$.list.refresh();
		this.$.channelsView.setServer(record);
		this.$.drill.selectViewByIndex(1, true);
	},
	showServers: function() {
		this.$.drill.selectViewByIndex(0, true);
	},
	// Re-emit the channel's chatthread selection upward (ThreadList's onSelectThread contract).
	relaySelectThread: function(inSender, inThread) {
		this.doSelectThread(inThread);
	},
	// ---- methods Messaging.js drives on every list, mirrored across both drill levels ----
	updateList: function() {
		this.$.list.update();
		this.$.channelsView.updateList();
	},
	resetList: function() {
		this.$.list.reset();
		this.$.channelsView.resetList();
	},
	setSelection: function(inChatThread) {
		this.$.channelsView.setSelection(inChatThread);
	},
	windowHiddenHandler: function() {
		// Return to the server list so re-opening the app doesn't strand the user mid-drill.
		this.$.drill.selectViewByIndex(0);
		this.$.list.punt();
	}
});
