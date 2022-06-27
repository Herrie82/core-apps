// generic "service" has the state of the system, as sysmgr knows it
enyo.kind({
	name: "SystemStatus",
	kind: enyo.Component,
	IMSTATUS: {
		AVAILABLE: 0,
		OFFLINE: 4
	},	
	components: [
		{name: "prefService", kind: enyo.PalmService, service: enyo.palmServices.system},		
		{name: "lockSubscription", kind:"PalmService", service:"palm://com.palm.systemmanager/", method: "getLockStatus", subscribe: true, onSuccess: "onLockStatusEvent"},
		{name: "DefaultRingtoneSub", kind:"PalmService", service:"palm://com.palm.systemservice/", method: "getPreferences", subscribe: true, onSuccess: "onIncomingCallOnCallSound", onFailure: "onIncomingCallOnCallSound"},
		{name: "loginStateSetter", kind: "DbService", method: "merge", onSuccess: "changedLoginState"},
		{name: "loginStateFinder", kind: "DbService", dbKind: "com.palm.imloginstate.skypem:1", method: "find", onSuccess: "gotLoginStates", subscribe: true, resubscribe: true, reCallWatches: true},
		//{name: "listAccounts", kind: "Accounts.getAccounts", onGetAccounts_AccountsAvailable: "onGotAccounts"},
	],
	create: function() {
		this.inherited(arguments);
		this.$.prefService.call({
			"keys": ["phoneisFirstTimeLaunched"]
		},{
			method: "getPreferences",
			onSuccess: "updateFirstTimeLaunchRecord", 
			onFailure: "updateFirstTimeLaunchRecord"
		});
				
		this.kDefaultCallOnCallSound = "/usr/palm/applications/com.palm.app.phone/sounds/incoming-call-active.wav";
		this.$.lockSubscription.call();
		this.$.DefaultRingtoneSub.call({"keys": ["phoneIncomingCallOnCallSound"]});
		this.$.loginStateFinder.call();
		
		if (!this.loginTimer) {
			// login will timeout after 2.5 minutes. this is really long, but intended to handle transports failing
			this.loginTimer = setTimeout(function() {
				this.loginTimer = undefined;
				enyo.application.Cache.skypeStatus = "unknown"; 
			}.bind(this), 150000);
		}		
		
		//this.getAccountList(); 
	},	
	updateFirstTimeLaunchRecord: function(inSender, response) {
		enyo.log("phoneApp was launched before? "+enyo.json.stringify(response));		
		if (response && response.returnValue) {
			if (response.phoneisFirstTimeLaunched !== undefined) {
				enyo.application.Cache.isFirstTimeLaunched = response.phoneisFirstTimeLaunched; 
			} 
		} 
	}, 
	
	setFirstTimeLaunchRecord: function(value) {
		this.$.prefService.call({
				"phoneisFirstTimeLaunched": value
			}, {
				method: "setPreferences",
				onSuccess: "onSetPrefResponse",
				onFailure: "onSetPrefResponse"
		});	
	},			
	
	onSetPrefResponse: function(inSender, response){
		enyo.log("setPref "+enyo.json.stringify(response));	
	}, 
	
	onLockStatusEvent: function(inSender, response) {	
		// let current state know we're now unlocked
		this.lockstatus = response && response.locked; 
		if ( ! response.locked ) {
			enyo.application.UI.event('lock', false);
		}
	},
	getLockStatus: function () {
		return this.lockstatus;
	},
	
	//Changes the default phoneIncomingCallSound
	onIncomingCallOnCallSound: function(inSender, response) {
		if ( response && response["phoneIncomingCallOnCallSound"] ) {
			enyo.log("new default sound " + response["phoneIncomingCallOnCallSound"]);
			this.kDefaultCallOnCallSound = response["phoneIncomingCallOnCallSound"];
		}
	},
	
	getDefaultCallOnCallSound: function() {
		return this.kDefaultCallOnCallSound;
	}, 
	
	gotLoginStates: function(inSender, inResponse){
enyo.log("debug: skype logging status response "+ enyo.json.stringify(inResponse));
		this.clearTimer(); 		
		if (inResponse && inResponse.returnValue === true) {
			var status = inResponse.results && inResponse.results[0];
			if (status) {
				//enyo.log("rui: skype logging status is "+ status.state);
				//enyo.log("rui: skype enyo.application.Cache.skypeStatus is "+ enyo.application.Cache.skypeStatus);
				
				if (enyo.application.Cache.skypeStatus !== status.state) {
					enyo.application.Cache.skypeStatus = status.state;
					enyo.log("debug: skype status is "+ enyo.application.Cache.skypeStatus);
					enyo.application.UI.event('updateView', {"updateSkype": true});
				}
			} else {
				//we find out we have multiple status returned during signing in
				//process, we will either time out or go for a online status
				enyo.error("debug: skype logging status is not available");
				enyo.application.Cache.skypeStatus = "unknown"; 				
			}
		} 
	},	
	
	saveAvailability: function(value, setSpinner) {
		this.status = value;
		this.$.loginStateSetter.call({
			"props": {
				"availability": value
			},
			"query": {
				"from": "com.palm.imloginstate.skypem:1"
			}
		});
	},	
	
	changedLoginState: function(inSender, inResponse) {
		if (inResponse && inResponse.count > 0 && this.status === this.IMSTATUS.AVAILABLE) {
			this.fetchLoginStates();
			return; 
		} 

		if (this.status !== this.IMSTATUS.OFFLINE) {
			enyo.error("unable to change skype login state to "+this.status)
		}
		
		this.setLoginStatus("offline");
		if (this.loginTimer) {
			this.clearTimer();
		}
	},
	
	fetchLoginStates: function() {
		this.$.loginStateFinder.cancel();
		this.$.loginStateFinder.call();
		
		if (!this.loginTimer) {
			// login will timeout after 1.5 minutes. this is really long, but intended to handle transports failing
			this.loginTimer = setTimeout(function() {
				this.loginTimer = undefined;
				this.saveAvailability(this.IMSTATUS.OFFLINE);
			}.bind(this), 90000);
		}		
	},		
	
	clearTimer: function(){
		clearTimeout(this.loginTimer);
		this.loginTimer = undefined;		
	}
	/*onGotAccounts: function(inSender, inResponse) {
        enyo.log("debug:: rui inResponse.accounts.length:"+JSON.stringify(inResponse.accounts.length));
        if (inResponse.templates) {
			this._accountTemplates = inResponse.templates;		
		}
	},
	getAccountList: function() {
		this.$.listAccounts.getAccounts({capability: "PHONE"});		
	},*/ 	
});


