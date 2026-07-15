/*globals enyo */

// Servers/Rooms (Milestone 2): live-subscribed feeds of the imserver (guild/network) and
// imchannel (room) hierarchy that the chatthreader builds from tagged MUC messages (M1). Modeled
// on ThreadService/FavoriteService but far simpler - the records are already self-contained, so
// there is no person/status join to do; we just page a subscribe find and re-emit on watch.

enyo.kind({
	name: "ServerService",
	kind: enyo.Service,
	requestKind: "ServerRequest",
	events: {
		onWatch: ""
	}
});

enyo.kind({
	name: "ServerRequest",
	kind: enyo.Request,
	events: {
		onWatch: "doWatch"
	},
	components: [
		{kind: "DbService", onFailure: "fail", components: [
			{name: "servers", dbKind: "com.palm.imserver:1", method: "find", subscribe: true, onSuccess: "gotServers", onWatch: "doWatch"}
		]}
	],
	finish: function() {
		// don't destroy automatically, so we can keep the subscribe watch alive
	},
	call: function() {
		this.$.servers.cancel();
		this.$.servers.call(this.params);
	},
	fail: function(inSender, inResponse) {
		enyo.error("ServerRequest DbService fail: ", inResponse);
		this.receive({returnValue: false, results: []});
	},
	gotServers: function(inSender, inResponse) {
		this.receive(inResponse);
	}
});

enyo.kind({
	name: "ChannelService",
	kind: enyo.Service,
	requestKind: "ChannelRequest",
	events: {
		onWatch: ""
	}
});

enyo.kind({
	name: "ChannelRequest",
	kind: enyo.Request,
	events: {
		onWatch: "doWatch"
	},
	components: [
		{kind: "DbService", onFailure: "fail", components: [
			{name: "channels", dbKind: "com.palm.imchannel:1", method: "find", subscribe: true, onSuccess: "gotChannels", onWatch: "doWatch"}
		]}
	],
	finish: function() {
		// don't destroy automatically, so we can keep the subscribe watch alive
	},
	call: function() {
		this.$.channels.cancel();
		this.$.channels.call(this.params);
	},
	fail: function(inSender, inResponse) {
		enyo.error("ChannelRequest DbService fail: ", inResponse);
		this.receive({returnValue: false, results: []});
	},
	gotChannels: function(inSender, inResponse) {
		this.receive(inResponse);
	}
});
