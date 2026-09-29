/*jslint laxbreak: true, white: false, devel: true */
/*global Class: false, Mojo: false, $L: false, Template: false, Event: false, Form: false, Task: false, TaskList: false, Weave: false, State: false, DatePickerAssistant: false, db:false */

/**
Copyright 2010 Palm, Inc.  All rights reserved.
*/

var DashboardAssistant = function(){
	Mojo.Log.info("Initializing DashboardAssistant");
	this.dashboard = undefined;
	
	var createDashboard = function(){
		db.getDueTasksAsArray({}, this.updateDashboard, this.createDashboardRetry, this);
	};
	
	var createDashboardRetry = function(){
		db.getDueTasksAsArray({}, this.updateDashboard, (function justReturn(){
			return false;
		}), this);
	};
	
	var openSpecificTask = function(params){
		Mojo.Log.info("||||||||CALLED OPENSPECIFICTASK" + JSON.stringify(params));
		var args = {
			"taskListId": params.taskListId,
			"taskId": params.id,
			"action": "dashboardTap"
		};
		
		var serviceHandle = new Mojo.Service.Request ("palm://com.palm.applicationManager",
		{	
			method		:	"launch",
			parameters: {
				id: "com.palm.app.tasks",
				params: args
			},
			onSuccess: Mojo.doNotihing,
			onFailure: Mojo.doNotihing
		});
	};
	
	var openTasksApp = function(params){
		Mojo.Log.info("||||||||CALLED OPENTASKSAPP" + JSON.stringify(params));		
		var args = {
			"taskListId": params.taskListId,
			"action": "dashboardTap"
		};
		if (params._dashboardCount === 1){ //if only one item in notification stack, provide taskId to open specific task scene
			args.taskId = params.id;
		}
		
		var serviceHandle = new Mojo.Service.Request ("palm://com.palm.applicationManager",
		{	method		:	"launch",
			parameters: {
				id: "com.palm.app.tasks",
				params: args
			},
			onSuccess: Mojo.doNotihing,
			onFailure: Mojo.doNotihing
		});
	};
	
	var updateDashboard = function(itemsArray){
		var items = [];
		var iconPath = "images/notification-large.png";
		
		Mojo.Log.info("In updateDashboard " + JSON.stringify(itemsArray));
		for (var item = 0; item < itemsArray.length; item++) {
			var content = {
				icon: iconPath,
				title: itemsArray[item].subject,
				text: itemsArray[item].taskListName,
				id: itemsArray[item]._id,
				taskListId: itemsArray[item].taskListId
			};
			
			items.push(content);
		}
		
		this.dashboard = Mojo.Controller.getAppController().createDashboard("TasksDashboardStage", items, {
			mainTapHandler: this.openSpecificTask,
			iconTapHandler: this.openTasksApp
		});
	};
			
	var publicStuff = {
		createDashboard : createDashboard,
		openTasksApp : openTasksApp,
		openSpecificTask : openSpecificTask,
		updateDashboard : updateDashboard
	};
	
	return publicStuff;
};