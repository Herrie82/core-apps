/*jslint laxbreak: true, white: false, devel: true */
/*global Class: false, Mojo: false, $L: false, Template: false, Event: false, Form: false, MojoLoader: false, window: false, Foundations: false, ActivityManager: false, db: false */

/* Copyright 2010 Palm, Inc.  All rights reserved. */


var Constants = function (){
	return {
		TASKKIND : "com.palm.task:1",
		TASKKINDEAS : "com.palm.task.eas:1",
		TASKPOSITIONSTEP : 1000,
		TASKS_POSITION_DESCENDING : false,
		TASKLISTKIND : "com.palm.tasklist:1",
		TASKLISTKINDALL : "com.palm.tasklist.alltasks:1",
		TASKLISTKINDEAS : "com.palm.tasklist.eas:1",
		TASKLISTKINDUNFILED	: "com.palm.tasklist.unfiled:1",
		TASKLISTPOSITIONSTEP : 1000,
		TASKLISTS_POSITION_DESCENDING : true,
		PALM_DB_SERVICE_NAME : "com.palm.db",
		PALM_ACTIVITY_MANAGER_NAME : "com.palm.activitymanager",
		TASKS_APPLICATION_NAME : "com.palm.app.tasks",
		ACCOUNTS_SERVICE_NAME : "com.palm.service.accounts",
		SYSTEM_SERVICE_NAME : "com.palm.systemservice",
		APPLICATION_MANAGER_NAME : "com.palm.applicationManager",
		ACCOUNTKIND : "com.palm.account:1"
	};
};
