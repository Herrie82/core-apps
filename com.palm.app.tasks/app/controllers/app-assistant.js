/*jslint laxbreak: true, white: false, devel: true */
/*global Class: false, Mojo: false, $L: false, Template: false, Event: false, Form: false, Weave: false,
DatabaseManager: false, DashboardAssistant: false, Task: false, TaskList: false, ActivityManager: false,
Constants:false, MojoLoader:false, window:false, Foundations: false */
/**
 * Global state shared within the app for scene transitions.
 * Copyright 2009 Palm, Inc.  All rights reserved.
*/

/**
 * <IMPORTS>
 */

var libraries = MojoLoader.require(
	{
		name: "foundations",
		"version": "1.0"
	},
	{
		name: "accounts.ui", 
		"version": "1.0"
	}
);
window.Foundations = libraries.foundations;
window.AccountsLib = libraries["accounts.ui"];

var PalmCall = Foundations.Comms.PalmCall;
/**
 * <\IMPORTS>
 */

///////////////////////////////////////////////PERFORMANCE//
var LAST_TIMESTAMP=null;
var DEBUG_TIME_FLAG = false;
var DEBUG_TIME = function (textString){
	if (DEBUG_TIME_FLAG !== true){
		return;
	}
	
	var timestamp = (new Date()).getTime();
	var output = "*****TIME : " + timestamp;
	if (LAST_TIMESTAMP){
		output += (" DIFF " + (timestamp-LAST_TIMESTAMP));
	}
	LAST_TIMESTAMP = timestamp;
	if (textString && textString.length > 0){
		output += (" " + textString);
	}
	
	Mojo.Log.error(output);
};
////////////////////////////////////////////////////////////

var State =
{
	listOfLists: new Weave.Models.Model(),
	taskList: null,
	task: null 
};

var db, activityManager;
var dashboardAssistant; 
var constants = Constants();

var AppAssistant = Class.create(
{
	initialize: function ()
	{
	    Mojo.Log.info('AppAssistant::initialize %s');
	},

	/**
	 * Setup the system by adding two interfaces:
	 *  main	- handles general launch and relaunch
	 *  details	- (re)launch the app pointing at a specific taskList and task.
	 */
	setup: function()
	{
	    Mojo.Log.info('AppAssistant::setup');		
		
		Weave.System.Activator.addIndex('default', 'index-default');
		Weave.System.Activator.addInterface({ name: 'main', stagename: 'default' },
		{
			start: function(stage)
			{
				(function()
				{
					stage.controller.pushScene('tasklists');
				}).defer();
			},
			
			restart: function(stage)
			{
				stage.controller.activate();
			}
		});
		Weave.System.Activator.addInterface({ name: 'details', stagename: 'default' },
		{
			show: function(args, stage)
			{
				stage._showTaskAndTaskList(args);
			}
		});
	},
	
	cleanup: function()
	{
		Mojo.Log.info("AppAssistant::cleanup");
	},
	
	callSuccess : function(params){
		var returnMessage = "SUCCESS";
		if (params && typeof(params) === "string"  && params.length > 0){
			returnMessage += (" - " + params);
		}
		Mojo.Log.info(returnMessage);
	},
	
	callFailure : function(params){
		var returnMessage = "FAILURE";
		if (params && typeof(params) === "string" && params.length > 0){
			returnMessage += (" - " + params);
		}
		Mojo.Log.error(returnMessage);
	},
	
	instantiateActivityMgrSingleton : function (callback){
		if (!activityManager) { //instantiate activityManager
            activityManager = ActivityManager();
        }
		if (callback && typeof(callback) === "function"){
			callback();
		}
	},
	
	instantiateDbSingleton : function (callback){
		if (!db){ //instantiate db-manager
			db = DatabaseManager();
		}
		if (callback && typeof(callback) === "function"){
			callback();
		}
	},
	
	instantiateDashboardSingleton : function (callback){
		if (!dashboardAssistant){
			dashboardAssistant = DashboardAssistant(this);
		}
		if (callback && typeof(callback) === "function"){
			callback();
		}
	},
		
	launchOnBoot: function (params){
		Mojo.Log.info("CREATING BOOT ACTIVITIES FOR TASKS");
			
		this.instantiateActivityMgrSingleton();
		this.instantiateDbSingleton();
		this.instantiateDashboardSingleton();		
		
		activityManager.createBootActivity(); //reschedule self first
		activityManager.createDBActivity(this.callSuccess, this.callFailure);	
		activityManager.createTimeChangedActivity(this.callSuccess, this.callFailure); //calls db.createAMActivity;
		
		db.mapAccounts( //map accounts - ids needed for creating default tasklists
			function(){
				db.checkTaskLists( //on account mapping success, check that defaults tasklists exist, else create.
					function(){
						db.updateTotals(true); //true = trigger dashboard notifications, update due totals on tasklists
					}, 
					this.callFailure
				);
			}.bind(this), 
			this.callFailure, 
			false
		);
	},
	
	launchDashboardTap: function(params){
		Mojo.Log.info("DASHBOARD TAP");
			
		var dashboardWeaveLaunchParams = {
			details: {
				show: {
					taskListId: params.taskListId,
					taskId: params.taskId
				}
			}
		};
		
		Weave.System.Activator.run(dashboardWeaveLaunchParams); //app is up, no need to checkTaskLists, mapAccounts
	},
	
	launchDBDueWatchActivity: function(params){
		Mojo.Log.info("SET OF DUE TASKS MODIFIED - UPDATE FIRING");
		
		this.instantiateDbSingleton();
		this.instantiateActivityMgrSingleton();
		this.instantiateDashboardSingleton();
		
		activityManager.rescheduleDBActivity();

		db.checkTaskLists( //map existing local tasklists
			function(){
				db.updateTotals(true);
			},
			this.callFailure
		);	
	},
	
	launchAMWatchActivity: function(params){
		Mojo.Log.info("12 AM DAY BOUNDARY CROSSED - UPDATE FIRING");
			
		this.instantiateDbSingleton();
		this.instantiateActivityMgrSingleton();
		this.instantiateDashboardSingleton();
		
		activityManager.rescheduleAMActivity();
		activityManager.rescheduleDBActivity();	
		
		db.checkTaskLists( //map existing local tasklists
			function(){
				db.updateTotals(true);
			},
			this.callFailure
		);
	},
	
	launchTimeAdjustWatchActivity: function(params){
		Mojo.Log.info("SYSTEM TIME CHANGED (ntp/user) - UPDATE FIRING");
			
		this.instantiateActivityMgrSingleton();
		
		activityManager.rescheduleTimeChangedActivity(
			params, 
			function(){
				this.instantiateDbSingleton();
				this.instantiateDashboardSingleton();
				db.updateTotals(true);
				activityManager.rescheduleDBActivity();
			}.bind(this)
		);	
	},
	
	launchQuickAction : function (params){
		Mojo.Log.info("QUICK ACTION LAUNCH");

		this.instantiateActivityMgrSingleton();			
		this.instantiateDbSingleton();
		this.instantiateDashboardSingleton();

		db.markNewSyncedTaskPositions(this.callSuccess, this.callFailure); 
		db.markNewSyncedTaskListPositions(this.callSuccess, this.callFailure);

		db.checkTaskLists( //map existing local tasklists or create them 
			function(){
				var quickActionWeaveLaunchParams = {
					details: {
						show: {
							taskListId: db.getUnfiledTaskListId(),
							taskSubject: params.taskSubject
						}
					}
				};				 
				Weave.System.Activator.run(quickActionWeaveLaunchParams);	
			}.bind(this),
			this.callFailure
		);
	},
	
	launchRegular: function(params){
		Mojo.Log.info("REGULAR LAUNCH");
DEBUG_TIME("LAUNCHREGULAR BEFORE DBSERVICE, DASHBOARD, ACTIVITYMGR INSTANTIATION"); //TASK: REMOVE DEBUG TIMING		
		this.instantiateActivityMgrSingleton();			
		this.instantiateDbSingleton();
		this.instantiateDashboardSingleton();
DEBUG_TIME("LAUNCHREGULAR AFTER INST"); //TASK: REMOVE DEBUG TIMING
		db.markNewSyncedTaskPositions(this.callSuccess, this.callFailure); 
		db.markNewSyncedTaskListPositions(this.callSuccess, this.callFailure);
DEBUG_TIME("LAUNCHREGULAR AFTER MARKNEWSYNCEDPOS"); //TASK: REMOVE DEBUG TIMING		

		db.checkTaskLists( //map existing local tasklists or create them 
			function(){
				DEBUG_TIME("LAUNCHREGULAR AFTER CHECKTASKLISTS"); //TASK: REMOVE DEBUG TIMING
				db.quickMapLocalAccount(function(){
					Weave.System.Activator.run(params);
				}.bind(this), null);
			}.bind(this),
			this.callFailure
		);
	},
		
	handleLaunch: function(params) //params.action determines function to call, if none set-opens stage. if set, but not valid, error.
	{
DEBUG_TIME("IN HANDLELAUNCH"); //TASK: REMOVE DEBUG TIMING
		Mojo.Log.info("AppAssistant::handleLaunch " + JSON.stringify(params));
		if (params && params.taskSubject){
			this.launchQuickAction(params);
		} else if (params && params.action){
			if (params.action === "createDefaultTasklists"){ //do boot-time init
				this.launchOnBoot(params);
			} else if (params.action === "dashboardTap"){ //dashboard tap
				this.launchDashboardTap(params);			
			} else if (params.action === "rescheduleDBActivity"){ //reschedule 'due tasks changed in db' activity
				this.launchDBDueWatchActivity(params);
			} else if (params.action === "rescheduleAMActivity"){ //reschedule '12:00 am' activity
				this.launchAMWatchActivity(params);			
			} else if (params.action === "rescheduleTimeChangedActivity"){ //reschedule 'time change' activity
				this.launchTimeAdjustWatchActivity(params);
			} else { //in case params.action has an invalid value
				this.launchRegular(params);
			}
		} else { //launch main app stage if no params.action in params, or no params altogether
			this.launchRegular(params);
		}
	}
});

/**
 * Default Stage Manager.
 * We enhance it by adding the Help system (so all scenes share it).
 */
var DefaultStageAssistant = Class.create(
{
	setup: function()
	{
		Mojo.Log.info("StageAssistant::setup");
		Weave.Utilities.AppMenu.setDefault(new Weave.Utilities.AppMenu(this).addEdit().addHelp('http://help.palm.com/tasks/index.html'));
	},
	
	cleanup: function()
	{
		Mojo.Log.info("StageAssistant::cleanup");
	},

	/**
	 * Open the app at the place indicated by the taskId and taskListId.
	 * We try to do this by changing the minimum number of scenes.
	 * 
	 * @param {Object} arg
	 */
	
	_quickLaunchScenePush: function(ctrlAndTop, arg){
		var top = ctrlAndTop.top;
		var ctrl = ctrlAndTop.ctrl;
		
		if (top) 
		{
			if (top.sceneName === 'tasks' && State.taskList && State.taskList.id === arg.taskListId && !arg.taskId) 
			{
				arg.taskListId = null;
			}
			else if (top.sceneName === 'task' && State.task && State.task.id === arg.taskId) 
			{
				arg.taskListId = null;
				arg.taskId = null;
			}
		}
		if (arg.taskListId) 
		{
			State.taskList = new TaskList({ id: arg.taskListId }).load(this, function()
			{
				State.task = new Task({ id: arg.taskId }).load(this, function()
				{
					if (!top) 
					{
						ctrl.pushScene('tasklists');
					}
					else 
					{
						ctrl.popScenesTo('tasklists');
					}
					ctrl.pushScene('tasks');
					ctrl.pushScene('task');
				});
			});
		}
		else if (arg.taskId)
		{
			State.task = new Task({ id: arg.taskId }).load(this, function()
			{
				ctrl.pushScene('task');
			});
		}
	},
	
	_quickActionScenePush: function(ctrlAndTop, arg){
		var top = ctrlAndTop.top;
		var ctrl = ctrlAndTop.ctrl;

		if (top) 
		{
			if (top.sceneName === 'tasks' && State.taskList && State.taskList.id === arg.taskListId) 
			{
				arg.taskListId = null;
			}
			else if (top.sceneName === 'task' && State.task) 
			{
				ctrl.popScenesTo('tasklists');
			}
		}
		if (arg.taskListId) 
		{
			State.taskList = new TaskList({ id: arg.taskListId }).load(this, function()
			{
				State.task = new Task({ subject: arg.taskSubject, completed:false, forceSave: true });
				if (!top) 
				{
					ctrl.pushScene('tasklists');
				}
				else 
				{
					ctrl.popScenesTo('tasklists');
				}
				ctrl.pushScene('tasks');
				ctrl.pushScene('task');
			});
		}
	},
	
	_showTaskAndTaskList: function(arg)
	{
		Mojo.Log.info("_showTaskAndTaskList %j", arg);
		var ctrl = Mojo.Controller.getAppController().getStageController("default");
		
		var top = ctrl.topScene();
		
		if (arg.taskSubject){ //quick action
			this._quickActionScenePush({ctrl:ctrl, top:top}, arg);
		} else if (arg.taskId && arg.taskListId){ //launch
			// Push the specific task and list.
			this._quickLaunchScenePush({ctrl:ctrl, top:top}, arg);
		} else {
			// If no specific task or list, we just go the main view.
			if (!top) 
			{
				ctrl.pushScene('tasklists');
			}
			else 
			{
				ctrl.popScenesTo('tasklists');
			}
		}
		ctrl.activate();
	}
});
