// webOS: live buddy-presence cache, shared across the whole Phone app UI (Dialer/ContactLookup/
// AddressingList/VideoAddressingList). Originally Skype-only (queried com.palm.imbuddystatus.skypem:1,
// keyed by bare username - fine when Skype was the only IM service with a PHONE capability). Skype's
// backend and db kind are gone; every current connector (WhatsApp/Signal/Telegram/Teams/Discord/
// Google Chat/...) publishes into the same POLYMORPHIC base kind instead (com.palm.imbuddystatus:1,
// _kind discriminates e.g. "com.palm.imbuddystatus.libpurple:1" - see accountService/ConversationList
// in com.palm.app.messaging, which already reads this same base kind). Query that base kind so this
// cache covers every service with no per-connector code, and key by "serviceName|username" (not bare
// username) since usernames are no longer guaranteed unique across services (e.g. the same phone
// number on both WhatsApp and Signal).
enyo.kind({
	name: "ImBuddyStatusCache",
	kind: enyo.Component,
	components: [{name: "dbBuddies", kind: enyo.TempDbService, dbKind: "com.palm.imbuddystatus:1",
					method: "find", subscribe: true, onSuccess: "_gotBuddies", reCallWatches: true},
		{name:"buddyStatusListeners",    kind:"Utils.Dispatcher"},
	],
	events: {
		onGotBuddies: ""
	},

	create: function() {
		this.inherited(arguments);
		this.resetItems();
		this._getBuddies();
	},

	destroy: function() {
		enyo.job.stop(this.id + "dispatchBuddyStatus");
		this._buddies = null;
		this.$.dbBuddies.cancel();
		this.inherited(arguments);
	},

	resetItems: function() {
		this._buddies = {};
	},

	_getBuddies: function() {
		this.$.dbBuddies.cancel();
		this.$.dbBuddies.call();
	},

	_key: function(serviceName, username) {
		return serviceName + "|" + username;
	},

	// The watch on this kind fires far more often than presence actually changes: every connector
	// signal (sign-on, status change, avatar change, group change) ends up as a db8 MERGE in
	// BuddyStatusHandler::updateBuddyStatus, and a merge bumps _rev even when it writes the exact
	// same values - so with reCallWatches the watch re-fires every few seconds on a busy roster.
	// Only tell listeners when something they actually RENDER changed (the availability per
	// service+username); otherwise every listener rebuilds its contact list for nothing.
	_gotBuddies: function(inSender, inResponse, inRequest) {
		if (inResponse && inResponse.results) {
			var data = inResponse.results;
			this.resetItems();
			var signature = [];
			for (var i = 0; i < data.length; i++) {
				var buddy = data[i];
				if (buddy.username && buddy.serviceName) {
					var key = this._key(buddy.serviceName, buddy.username);
					this._buddies[key] = buddy;
					signature.push(key + "=" + this._availability(buddy));
				}
			}
			signature = signature.sort().join(",");
			if (signature === this._signature) {
				return;
			}
			this._signature = signature;
			// Coalesce bursts (a roster coming online signals one buddy at a time) into a single
			// dispatch, so listeners re-render once instead of once per buddy.
			enyo.job(this.id + "dispatchBuddyStatus", enyo.hitch(this, "dispatchBuddyStatus"), 500);
		}
	},

	_availability: function(buddy) {
		return buddy.personAvailability !== undefined ? buddy.personAvailability : buddy.availability;
	},

	// serviceName is required now (was optional/implicit when Skype was the only source) - callers
	// have itemAddress.type (== serviceName) available at every call site already.
	getBuddyInfo: function(serviceName, username) {
		return this._buddies && this._buddies[this._key(serviceName, username)];
	},

        dispatchBuddyStatus: function(payload) {
                this.$.buddyStatusListeners.dispatch(payload);
        },

        registerBuddyStatus: function(listener) {
                this.$.buddyStatusListeners.add(listener);
        },

        unregisterBuddyStatus: function(listener) {
                this.$.buddyStatusListeners.remove(listener);
        },
});
