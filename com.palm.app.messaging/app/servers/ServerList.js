/*globals enyo */

// Servers/Rooms (Milestone 2) tab host. Lives in the left panel's TabGroup+Pane (see
// app/Messaging.js). Presents a two-level drill-down inside its own inner Pane - a server
// (guild/network) list, and, once a server is tapped, that server's channel list - mirroring how
// ChatView (also a Pane) swaps sub-views. Selecting a channel bubbles the channel's chatthread up
// via onSelectThread (the same contract ThreadList uses) so MessagingApp opens it in the right-hand
// ChatView with no extra wiring. Going back up a level is driven by the app's bottom Toolbar: this
// kind fires onServerDrill(bool) and exposes showServers()/isDrilledIn() for Messaging to hook a
// footer "Servers" button (there is no built-in breadcrumb in this Enyo build).
enyo.kind({
	name: "ServerList",
	kind: "VFlexBox",
	events: {
		onSelectThread: "",
		onServerDrill: ""
	},
	components: [
		{kind: "ServerService", onSuccess: "gotServers", onWatch: "serversWatch"},
		{kind: "Pane", flex: 1, name: "drill", transitionKind: "enyo.transitions.LeftRightFlyin", components: [
			{name: "serversView", kind: "VFlexBox", flex: 1, components: [
				{name: "search", kind: "SearchInput", hint: $L("Search servers"), className: "enyo-middle", onchange: "filterList", onCancel: "filterList", changeOnInput: true, autoCapitalize: "lowercase"},
				{className: "header-shadow header-app-shadow"},
				{name: "emptyMessage", content: "", className: "messageTexts", showing: false},
				{flex: 1, name: "list", kind: "DbList", desc: false, onQuery: "listQuery", className: "messaging-listsDivider", onSetupRow: "listSetupRow", components: [
					{name: "serverItem", kind: "ServerItem", tapHighlight: true, onclick: "selectServer"}
				]}
			]},
			{name: "channelsView", kind: "ChannelList", onSelectThread: "relaySelectThread"}
		]}
	],
	create: function() {
		this.inherited(arguments);
		this.drilledIn = false;
		// Start on the server list; the channel view is shown only after a drill-down.
		this.$.drill.selectViewByIndex(0);
	},
	serversWatch: function() {
		this.$.list.reset();
	},
	filterList: function() {
		this.filterString = this.$.search.getValue();
		this.$.list.punt();
	},
	listQuery: function(inSender, inQuery) {
		// No where-clause: show every server, ordered by account type (byservice index). Search is
		// applied client-side in gotServers so no extra db index is needed for these small lists.
		inQuery.orderBy = "serviceName";
		return this.$.serverService.call({query: inQuery});
	},
	gotServers: function(inSender, inResponse, inRequest) {
		inResponse = this.applyFilter(inResponse, ["displayName", "name"]);
		this.$.list.queryResponse(inResponse, inRequest);
		if ((inRequest.index === 0) && (!inResponse.results || inResponse.results.length === 0)) {
			this.$.emptyMessage.setContent(this.filterString ? $L("No servers match your search.") :
				$L("No servers yet. Add a Discord, IRC, Teams, Slack or Matrix account to see its servers here."));
			this.$.emptyMessage.show();
		} else {
			this.$.emptyMessage.hide();
		}
	},
	// Filter the current page in memory (server/channel lists are small - a handful of rows - so a
	// single page holds them all and search needs no tokenized db index).
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
		this.setDrilled(true);
	},
	showServers: function() {
		this.$.drill.selectViewByIndex(0, true);
		this.setDrilled(false);
	},
	setDrilled: function(inDrilled) {
		this.drilledIn = inDrilled;
		this.doServerDrill(inDrilled);
	},
	isDrilledIn: function() {
		return this.drilledIn;
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
		if (this.drilledIn) {
			this.setDrilled(false);
		}
		this.filterString = "";
		this.$.search.setValue("");
		this.$.list.punt();
	}
});
