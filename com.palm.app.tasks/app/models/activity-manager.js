/*jslint laxbreak: true, white: false, devel: true */
/*global Class: false, Mojo: false, $L: false, Template: false, Event: false, 
 Form: false, MojoLoader: false, window: false, Foundations: false, ActivityManager: false,
 db: false, constants: false, PalmCall: false */

/* Copyright 2010 Palm, Inc.  All rights reserved. */

/**
 * MAIN CLASS
 */

function ActivityManager(){
	
	var initialize = function(){};
	
	var createDBActivity = function(successCallback, failCallback){
		this.tasksChangedActivity = new Mojo.Service.Request("palm://"+constants.PALM_ACTIVITY_MANAGER_NAME , {
			method: "create",
			parameters: {
				"activity": {
					"name": "TASKS_DB_CHANGED_ACTIVITY",
					"description":"Tasks app activity that fires when due tasks added/removed/modified",
					"type": {
						"persist": true,
						"cancellable": true,
						"foreground" :true
					},
					"callback": {
						"method": "palm://" + constants.APPLICATION_MANAGER_NAME + "/launch",
						"params": {
								"id": constants.TASKS_APPLICATION_NAME,
								"params": {"action":"rescheduleDBActivity"}
						}
					},
					"trigger": {
						"method": "palm://" + constants.PALM_DB_SERVICE_NAME + "/find",
						"params": {
							"query": {
								"from": constants.TASKKIND,
								"where": [{
									"prop": "completed",
									"op": "=",
									"val": false
								}, {
									"prop": "dueDate",
									"op": ">=",
									"val": 0
								},{
									"prop": "dueDate",
									"op": "<=",
									"val": db.getEndOfDayTimestamp()
								}],
								"limit": 0
							},
							"watch": true,
							"count": true
						}					
					}
				},
				subscribe: false,
				start:true,
				replace:true
			},
			onSuccess: function(params){
				if (successCallback) {
					successCallback(params);
				}
			}.bind(this),
			onFailure: function(params){
				if (failCallback) {
					failCallback(params);
				}
			}.bind(this)
		});	
	};
	
	var createBootActivity = function(successCallback, failCallback){
		this.tasksChangedActivity = new Mojo.Service.Request("palm://"+constants.PALM_ACTIVITY_MANAGER_NAME , {
			method: "create",
			parameters: {
				"activity": {
					"type": {
						"persist" : true,
						"foreground" : true,
						"cancellable" : true
					}, 
					"name": "tasks.firstrun",
					"description": "checks default taskLists on boot and schedules activities",
					"requirements":{"bootup":true},
					"callback":{
						"method": "palm://com.palm.applicationManager/launch",
						"params": {
							"id": "com.palm.app.tasks",
							"params": {"action":"createDefaultTasklists"}
						}
					}
				},
				"subscribe": false,
				"start": true,
				"replace": true
			},
			onSuccess: function(params){
				if (successCallback){
					successCallback(params);	
				}
			}.bind(this),
			onFailure: function(params){
				if (failCallback){
					failCallback(params);
				}
			}.bind(this)
		});	
	};
		
	var createAMActivity = function(successCallback, failCallback){
		this.tasksChangedActivity = new Mojo.Service.Request("palm://"+constants.PALM_ACTIVITY_MANAGER_NAME , {
			method: "create",
			parameters: {
				"activity": {
					"name": "TASKS_12AM_ACTIVITY",
					"description":"Tasks app activity that fires when 12:00 am reached",
					"type": {
						"persist": true,
						"cancellable": true,
						"foreground" :true
					},
					"callback": {
						"method": "palm://" + constants.APPLICATION_MANAGER_NAME + "/launch",
						"params": {
							
								"id": constants.TASKS_APPLICATION_NAME,
								"params": {"action":"rescheduleAMActivity"}
						}
					},
					"schedule" : {
						"start" : Date.today().add(1).days().toString('yyyy-MM-dd') + " 00:00:00",
						"local" : true
					}					
				},
				subscribe: false,
				start:true,
				replace:true
			},
			onSuccess: function(params){
				successCallback(params);
			}.bind(this),
			onFailure: function(params){
				failCallback(params);
			}.bind(this)	
		});	
		Mojo.Log.info("12AM re-count scheduled at : " + Date.today().add(1).days().toString('yyyy-MM-dd') + " 00:00:00");
	};
	
	var createTimeChangedActivity2 = function(successCallback, failCallback, timeDate){
		this.tasksChangedActivity = new Mojo.Service.Request("palm://"+constants.PALM_ACTIVITY_MANAGER_NAME , {
			method: "create",
			parameters: {
				"activity": {
					"name": "TASKS_TIME_CHANGED_ACTIVITY",
					"description":"Tasks app activity that fires when time is changed by the user in UI or by NTP",
					"type": {
						"persist": true,
						"cancellable": true,
						"foreground" :true
					},
					"callback": {
						"method": "palm://" + constants.APPLICATION_MANAGER_NAME + "/launch",
						"params": {
							
								"id": constants.TASKS_APPLICATION_NAME,
								"params": {
									"action": "rescheduleTimeChangedActivity",
									"previousTimeDate": timeDate
								}
						}
					},
					"trigger": {
						"method": "palm://" + constants.SYSTEM_SERVICE_NAME + "/time/getSystemTime",
						"params": {"subscribe":true}					
					}
				},
				subscribe: false,
				start:true,
				replace:true
			},
			onSuccess: function(params){
				successCallback(params);
			}.bind(this),
			onFailure: function(params){
				failCallback(params);
			}.bind(this)
		});	
	};
	
	var successActivity = function(){
		Mojo.Log.info("SUCCESS rescheduling activity");
	};
	
	var failureActivity = function(){
		Mojo.Log.error("FAILURE rescheduling activity");
	};

	var rescheduleDBActivity = function(){
		Mojo.Log.info ("Rescheduling totals activity");		
		createDBActivity(successActivity, failureActivity);
	};
	
	var rescheduleAMActivity = function(){
		Mojo.Log.info ("Rescheduling 12AM activity");
		createAMActivity(successActivity, failureActivity);
	};
	
	var createTimeChangedActivity = function (successCallback, failCallback, previousTimeDate, updateFunction){
		Mojo.Log.info("====================== IN CREATE TIMECHANGE ACTIVITY ========================");
		var getTimeFuture = PalmCall.call("palm://" + constants.SYSTEM_SERVICE_NAME + "/time/", "getSystemTime", {});
		var timeDate = {};
		getTimeFuture.then(this, function(getTimeFuture){
			if (getTimeFuture.result){
				
				timeDate.year = getTimeFuture.result.localtime.year;
				timeDate.month = getTimeFuture.result.localtime.month;
				timeDate.day = getTimeFuture.result.localtime.day;
				timeDate.timezone = getTimeFuture.result.timezone;
				createTimeChangedActivity2(successCallback, failCallback, timeDate);
				
				if (previousTimeDate && previousTimeDate.dontUpdate && previousTimeDate.dontUpdate === true){
					rescheduleAMActivity();
					if (updateFunction && typeof(updateFunction) === "function"){
						updateFunction(false); //update totals, dashboard notifications disabled						
					}
				} else if (!previousTimeDate || previousTimeDate.year != timeDate.year || 
					previousTimeDate.month != timeDate.month || 
					previousTimeDate.day != timeDate.day || 
					previousTimeDate.timezone != timeDate.timezone){
						rescheduleAMActivity();
						if (updateFunction && typeof(updateFunction) === "function"){
							updateFunction(true); //update totals, dashboard notifications enabled						
						}
				} else{
					rescheduleAMActivity();
					if (updateFunction && typeof(updateFunction) === "function"){
						updateFunction(false); //update totals, dashboard notifications disabled						
					}
				}
			} else {
				failCallback();
			}
			
			Mojo.Log.info("CreateTimeChangedActivity " + JSON.stringify(getTimeFuture));	
		});		
	};	
	
	var rescheduleTimeChangedActivity = function(launchParams, updateFunction){
		Mojo.Log.info ("Rescheduling time change activity");
		var previousTimeDate =  (launchParams && launchParams.previousTimeDate) ? launchParams.previousTimeDate : null;
		createTimeChangedActivity(successActivity, failureActivity, previousTimeDate, updateFunction);
	};
	
	//return public functions
	return {
		createBootActivity:createBootActivity,
		createDBActivity:createDBActivity,
		createAMActivity:createAMActivity,
		createTimeChangedActivity:createTimeChangedActivity,
		rescheduleDBActivity:rescheduleDBActivity,
		rescheduleAMActivity:rescheduleAMActivity,
		rescheduleTimeChangedActivity:rescheduleTimeChangedActivity
	};	
}























