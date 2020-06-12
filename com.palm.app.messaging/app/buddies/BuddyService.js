enyo.kind({
	name: "BuddyService",
	kind: enyo.Service,
	requestKind: "BuddyRequest",
	events: {
		onWatch: ""
	}
});

enyo.kind({
	name: "BuddyRequest",
	kind: enyo.Request,
	events: {
		onWatch: "doWatch"
	},
	components: [
		{kind: "DbService", onFailure: "fail", components: [
			{name: "buddies", method: "find", service: "palm://com.palm.tempdb/", dbKind: "com.palm.imbuddystatus:1", onSuccess: "gotBuddies", subscribe: true, onWatch: "doWatch"/*, resubscribe: true, reCallWatches: true*/},
			{name: "buddiesSearch", method: "search", service: "palm://com.palm.tempdb/", dbKind: "com.palm.imbuddystatus:1", onSuccess: "gotBuddies", subscribe: true, onWatch: "doWatch"/*, resubscribe: true, reCallWatches: true*/},
			{name: "threads", dbKind: "com.palm.chatthread:1", method: "find", onSuccess: "gotThreads", subscribe: true, onWatch: "doWatch"/*, resubscribe: true, reCallWatches: true*/ },
			{name: "people", dbKind: "com.palm.person:1", method: "find", onSuccess: "gotPeople", subscribe: true, onWatch: "doWatch"/*, resubscribe: true, reCallWatches: true*/}
		]},
		{name: "mockBuddies", kind: "MockDb", dbKind: "buddies/com.palm.imbuddystatus:1", method: "find", onSuccess: "gotBuddies", onFailure: "fail", onWatch: "doWatch"},
		{name: "mockPeople", kind: "MockDb", dbKind: "persons/com.palm.person:1", method: "find", onSuccess: "gotPeople", onFailure: "fail", onWatch: "doWatch"},
		{name: "mockThreads", kind: "MockDb", dbKind: "chatthreads/com.palm.chatthread:1", method: "find", onSuccess: "gotThreads", onFailure: "fail", onWatch: "doWatch"}
	],
	create: function() {
		this.inherited(arguments);
	},
	initComponents: function() {
		this.inherited(arguments);
		if (!window.PalmSystem) {
			this.$.buddies = this.$.mockBuddies;
			this.$.people = this.$.mockPeople;
			this.$.threads = this.$.mockThreads;
		}
	},
	call: function() {
	    //enyo.log(this.params);
		if (this.params && this.params.query && this.params.query.search) {
			this.params.query.search = undefined;
			this.$.buddiesSearch.cancel();
			this.$.buddiesSearch.call(this.params);
		} else {
			this.$.buddies.cancel();
			this.$.buddies.call(this.params);
		}
	},
	reply: function() {
		//enyo.log(this.data);
		this.receive(this.data);
	},
	fail: function(inSender, inResponse) {
		enyo.error("BuddyService - DbService failure: ", inResponse);
		this.reply();
	},
	finish: function() {
		// don't destroy automatically, so we can see watches
	},
	gotBuddies: function(inSender, inResponse, inRequest) {
	    //enyo.log("#@#@ got buddies in ", inRequest.latency, "ms");
	    //enyo.log(inResponse);
		this.data = inResponse;
		this.assembleIds();
		this.queryPeople();
	},
	assembleIds: function() {
		this.pids = [];
		for (var i=0, d; d=this.data.results[i]; i++) {
			this.pids.push(d.personId);
		}
	},
	queryPeople: function() {
		this.$.people.id = "buddyRequest_people";
		this.$.people.cancel();
		this.$.people.call({query: {
			                  where: [{
			                	       prop: "_id",
									   op: "=",
									   val: this.pids
								     }],
			                  select: enyo.messaging.person.selectAttributes
		                           }
		                  });
	},
	gotPeople: function(inSender, inResponse, inRequest) {
		// enyo.log("#@#@ got people in ", inRequest.latency, "ms");
		// enyo.log("#@#@ got people", inResponse);
		// join person data to buddy data
		enyo.messaging.utils.joinData(this.data, inResponse.results, "_id", "personId", "person");
		this.queryThreads();
	},
	queryThreads: function() {
		this.$.threads.id = "buddyRequest_threads";
		this.$.threads.cancel();
		this.$.threads.call({query: {
			                   where: [{ 
			                	         prop: "personId",
									     op: "=",
									     val: this.pids
								      }],
							   select: [
							            "_id",			
                                        "_kind",
                                        "personId",
                                        "normalizedAddress",
                                        "displayName",
                                        "unreadCount"
		                               ]
		                            }
		                   });
	},
	gotThreads: function(inSender, inResponse, inRequest) {
		//enyo.log("#@#@ got chat threads in ", inRequest.latency, "ms");
		//enyo.log("#@#@ got chat threads: ", inResponse);
		// join chat thread data to buddy data
		enyo.messaging.utils.joinData(this.data, inResponse.results, "personId", "personId", "thread");
		// all done now
		this.reply();
	}
});