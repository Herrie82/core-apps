/*jslint laxbreak: true, white: false, devel: true */
/*global Class: false, Mojo: false, $L: false, Template: false, Event: false, 
 Form: false, MojoLoader: false, window: false, Foundations: false, dashboardAssistant: false, 
 AccountsLib:false, constants: false, PalmCall: false, DEBUG_TIME:false */

/* Copyright 2010 Palm, Inc.  All rights reserved. */

/**
 * MAIN CLASS
 */

function DatabaseManager(){
	
////////////////////////////////////////////////////////////
///////////CONSTANTS AND GLOBAL (TO OBJECT) VARS
////////////////////////////////////////////////////////////

	var unfiledTaskListId = undefined;
	var alltasksTaskListId = undefined;
	var kindAccountMap = {}; //mapping of accountId : {taskKind, optional32x32iconPathString}
	var numEasAccounts = 0;
	var accountsSubscription = null;

////////////////////////////////////////////////////////////
///////////FUNCTIONS
////////////////////////////////////////////////////////////	
	
	var getUnfiledTaskListId = function (){
		if (unfiledTaskListId) {
			return unfiledTaskListId;
		}
		return null;
	};
	
	var getAllTasksTaskListId = function (){
		if (alltasksTaskListId) {
			return alltasksTaskListId;
		}
		return null;
	};
	
/* INPUT : none
 * RETURNS : String with UTC timestamp as number of milliseconds from Jan 1, 1970 to the end of today
 */	
	var getEndOfDayTimestamp = function(){
		var endOfDay = new Date(); // today's date
		endOfDay.setHours(11); //end of day
		endOfDay.setMinutes(59);//end of day
		endOfDay.setSeconds(59);//end of day
		endOfDay.setMilliseconds(999);//end of day
		
		return ( endOfDay.getTime() );
	};
	
	var _storeTaskListDueTotals = function (mergeObjects, createDashboard){
		if (!mergeObjects || mergeObjects.length === 0){
			return;
		}
		
		var mergeDBCallParams = {
			"objects": mergeObjects
		};
				
		Mojo.Log.info("=-=-=-=-=-=-=-=-=-= storeTaskListDueTotals dbCallParams" + JSON.stringify(mergeDBCallParams));		
		var getTasksFuture = PalmCall.call("palm://"+constants.PALM_DB_SERVICE_NAME+"/", "merge", mergeDBCallParams);
		getTasksFuture.then( function(){
			Mojo.Log.info("|||--|||--|||--|||updateTaskListDueTotals " + JSON.stringify(getTasksFuture));	
			if ("result" in getTasksFuture &&
				"results" in getTasksFuture.result){
				getTasksFuture.result = {"returnValue":true};
				//successCallback(returnResult);
			}else if ("exception" in getTasksFuture){
				//failCallback(getTasksFuture.exception);	
			}
		});	
		
		if (createDashboard === true) {
			Mojo.Log.info(">>>>>>>>>>>>>>>>>>>IN STORETASKLISTDUETOTALS CALLING DASHBOARDASSISTANT.CREATEDASHBOARD: " + createDashboard);
			dashboardAssistant.createDashboard();
		}	
	};
	
/* INPUT : accountId - MojoDB _id of account
 * RETURNS BOOL - IF NO ACCOUNTID, RETURN FALSE
 */
	var isEasAccount = function(accountId){
		if (!accountId){
			Mojo.Log.info("No argument passed to isEasAccount. Returning false");
			return false;
		}
		for (var mappingItem in kindAccountMap){
			if (mappingItem === accountId && 
			kindAccountMap[mappingItem].taskKind === constants.TASKKINDEAS){
				Mojo.Log.info("Account accountId " + accountId + " is an EAS account. Returning true.");
				return true;
			}
		}
		//Mojo.Log.info("Account accountId " + accountId + " is not an EAS account OR ACCOUNT NOT FOUND IN LOCAL LOOKUP TABLE. Returning false.");
		return false;
	};
	
		var calculateTaskListDueTotals = function (totals, createDashboard){
		var dbCallParams = {
			"query": {
				"from": constants.TASKKIND,
				"where":[{
					"prop": "completed",
					"op": "=",
					"val": false
				},{
					"prop": "dueDate",
					"op": "<=",
					"val": getEndOfDayTimestamp()
				},{
					"prop": "dueDate",
					"op": ">=",
					"val": 0
				}]
			}
		};
		
		Mojo.Log.info("=-=-=-=-=-=-=-=-=-=calculateTaskListDueTotals dbCallParams" + JSON.stringify(dbCallParams));		
		var getTasksFuture = PalmCall.call("palm://"+constants.PALM_DB_SERVICE_NAME+"/", "find", dbCallParams);
		getTasksFuture.then(this, function(){
			Mojo.Log.info("|||--|||--|||--|||calculateTaskListDueTotals " + JSON.stringify(getTasksFuture));	
			if ("result" in getTasksFuture &&
				"results" in getTasksFuture.result){
				
				Mojo.Log.info("=-=-=-=-=-=-=-=-=-= TOTALS BEFORE (should be at 0) " + JSON.stringify(totals));
				
				var resultTasks = getTasksFuture.result.results;
				Mojo.Log.info("=-=-=-=-=-=-=-=-=-= DUE TASKS " + JSON.stringify(resultTasks));				
				var item;
				
				for (item in resultTasks){
					if (resultTasks[item].dueDate){
						Mojo.Log.info("Due task " + JSON.stringify (resultTasks[item]));
						
						if (totals[resultTasks[item].taskListId]){
							totals[resultTasks[item].taskListId] ++;
						}else{
							totals[resultTasks[item].taskListId] = 1;
						}
					}
				}
				
				if (totals[null]){
					totals[unfiledTaskListId] = totals[null];
					delete totals[null];
				}
				
				Mojo.Log.info("=-=-=-=-=-=-=-=-=-= TOTALS AFTER (may be at 0) " + JSON.stringify(totals));
				
				var mergeObjects = [];
				var allTasksTotal = 0;
				
				for (item in totals){
					if (item){ //jslint
						if (item !== null){
							mergeObjects.push({"_id":item, "dueItemCount":totals[item]}); //insert total due for each taskList
						}
						
						allTasksTotal += totals[item];
					}
				}
				
				Mojo.Log.info("ALLTASKS TOTAL DUES " + allTasksTotal);
				
				mergeObjects.push({"_id":alltasksTaskListId, "dueItemCount":allTasksTotal}); //insert total for AllTasks
	
				getTasksFuture.result = {"returnValue":true};
				_storeTaskListDueTotals(mergeObjects, createDashboard);
			}
		});		
	};
	
/*INPUT : { list : [ DB_TASKLIST, DB_TASKLIST...]}
 *OUTPUT : { tasklistid1 : 0, tasklistid2 : 0, tasklistid3 : 0... } //all existing tasklists except 'All Tasks' 
 */
	var setupTotalsBatchQuery = function(params, createDashboard){ //params.list = array of taskList objects
		Mojo.Log.info ("=-=-=-=-=-=-=-=-=-= SETUP TOTALS BATCH QUERY : " + JSON.stringify(params));
		var totals = {}; //object with key:id,value:total (int) pairs of all taskLists except 'All Tasks'
		if (params && params.list){
			for (var item = 0; item <params.list.length; item++){
				if (params.list[item]._kind != constants.TASKLISTKINDALL) {
					totals[params.list[item].id] = 0;
				}
			}
		}
		Mojo.Log.info (" Due items per taskList " + JSON.stringify(totals));
		calculateTaskListDueTotals(totals, createDashboard);
	};
	
/* INPUT : accountId - MojoDB _id of account
 * RETURNS STRING - EITHER PATH TO FILE OR EMPTY
 */
	var getIconFromAccountId = function(accountId){
		if (!(accountId)) {
			Mojo.Log.info("No argument passed to getIconFromAcccountId. Returning default taskKind");
			return "";
		}
		for (var mappingItem in kindAccountMap){
			if (mappingItem === accountId && 
				kindAccountMap[mappingItem].iconLocation){
				Mojo.Log.info("Icon looked up by accountId. " + JSON.stringify(kindAccountMap[mappingItem]));
				return kindAccountMap[mappingItem].iconLocation;
			}
		}
//		Mojo.Log.info("Icon for account " + accountId + " not found");
		return "";
	};

	
	var getTaskLists = function(params, successCallback, failCallback){ 
		var visibleTaskListsQuery = {
			"query": {
				"from": constants.TASKLISTKIND,
				"orderBy": "position",
				"desc": constants.TASKLISTS_POSITION_DESCENDING,
				"where" : [{
					"prop": "visible",
					"op": "=",
					"val": true
				}]
			}
		};
		
		var unfiledQuery = {
			"query": {
				"from": constants.TASKLISTKINDUNFILED
			}
		};
		
		var findVisibleTaskLists = {
			"method": "find",
			"params": visibleTaskListsQuery
		};
		
		var findUnfiled = {
			"method": "find",
			"params": unfiledQuery
		};
		
		var dbCallParams = {
			"operations": [findVisibleTaskLists, findUnfiled]
		};

//implement _new:bool, unfiled:bool, offset:int, limit:int
		Mojo.Log.info("||||||||||||||||||||||\n\n " + JSON.stringify(dbCallParams));
		Mojo.Log.info("|||||||||||||||| in getTaskLists");


		var getTaskListsFuture = PalmCall.call("palm://"+constants.PALM_DB_SERVICE_NAME+"/", "batch", dbCallParams);
		getTaskListsFuture.then(function(){
			Mojo.Log.info("|||--|||--|||--|||" + JSON.stringify(getTaskListsFuture));	

			if (getTaskListsFuture.result && 
				getTaskListsFuture.result.responses && //batch responses exist 
				getTaskListsFuture.result.responses.length === 2 && //for both visible tasklists and unfiled
				getTaskListsFuture.result.responses[1].results.length === 1) //unfiled exists
			{

				var returnResult = {"list":[]};

				if (getTaskListsFuture.result.responses[1].results[0].visible === false){
					getTaskListsFuture.result.responses[0].results.push(getTaskListsFuture.result.responses[1].results[0]); //push unfiled on array of visible TLs if Unfiled is invisible
				}
				
				var taskListsArray = getTaskListsFuture.result.responses[0].results;
				var resultCount = taskListsArray.length; 
				for (var index = 0; index < resultCount; index++){
					if ( params.filter && 
						(taskListsArray[index].name.toLowerCase()).indexOf((params.filter).toLowerCase()) == -1 ){
							taskListsArray.splice(index, 1);
							resultCount = taskListsArray.length;
							index--;
							continue;
					}
					var taskListObject = {};
					for (var taskListProperty in taskListsArray[index]){
						if (taskListProperty === "_id"){
							taskListObject.id = taskListsArray[index][taskListProperty];
						}else
						{
							taskListObject[taskListProperty]=taskListsArray[index][taskListProperty];
						}
					}
					if (isEasAccount(taskListObject.accountId)){
						taskListObject.flags = 65536;
						if (taskListObject.name === "Tasks"){// || taskListObject.name === "Exchange"){
							taskListObject.name = $L('Exchange');
//							if (hasMultipleEasAccounts() === false) {
//								taskListObject.name = $L('Exchange');
//							}else{
//								taskListObject.name = ($L('Exchange') + " - " + getEasAccountName(taskListObject.accountId));
//							}
						}	
					}else if (taskListObject._kind === constants.TASKLISTKINDUNFILED){
						taskListObject.flags = 1;
					}else if (taskListObject._kind === constants.TASKLISTKIND){
						taskListObject.flags = 0;	
					}else{
						taskListObject.flags = null;
					}
					
					var iconLocation = getIconFromAccountId(taskListObject.accountId); //get icon location string or null
					
					if (iconLocation){
						taskListObject.iconLocation = iconLocation;
						taskListObject.iconPresent = taskListObject.iconLocation ? 'block' : 'none'; //set icon presence flag
					}
					
					returnResult.list.push(taskListObject);
				}
				returnResult.count = returnResult.list.length;
				returnResult.offset = params.offset;
				returnResult.limit = params.limit;
				getTaskListsFuture.result={"returnValue":true, "result":returnResult};
				successCallback(returnResult);
			}else if ("exception" in getTaskListsFuture){
				getTaskListsFuture.result={"returnValue":false};
				failCallback(getTaskListsFuture.exception);	
			}
		});		
	};
	
	var createTaskListsHelper = function(future){
		var successCallback = future.TASKS.successCallback;//get passed vars out of future object
		var failCallback = future.TASKS.failCallback;
		var createAllTasks = future.TASKS.createAllTasks;
		var createUnfiled = future.TASKS.createUnfiled;
		
		if (future.TASKS){ //so that JSON.stringify(future) does not stringify circular object
			delete future.TASKS;
		}

		Mojo.Log.info ("in createTaskListHelper. future : " + JSON.stringify(future));
		if ("result" in future &&
			"responses" in future.result && 
			future.result.responses.length > 0){
			var unfiledOk = false;
			var allTasksOk = false;
			
			if (createUnfiled === true && 
			future.result &&
			future.result.responses.length > 0 && 
			future.result.responses[0] && 
			future.result.responses[0].results && 
			future.result.responses[0].results.length > 0){
				unfiledTaskListId = future.result.responses[0].results[0]._id;
				Mojo.Log.info("Unfiled taskList not found. Creating Unfiled taskList with _id=\"" + unfiledTaskListId + "\"");
				unfiledOk = true;
			}else if (createUnfiled === false){
				unfiledOk = true;
			}
			
			if (createAllTasks === true){
				if (createUnfiled === true && 
				future.result &&
				future.result.responses.length > 1 && 
				future.result.responses[1] && 
				future.result.responses[1].results && 
				future.result.responses[1].results.length > 0){
					alltasksTaskListId = future.result.responses[1].results[0]._id;
					allTasksOk = true;
				}else if (future.result &&
				future.result.responses.length > 0 && 
				future.result.responses[0] && 
				future.result.responses[0].results && 
				future.result.responses[0].results.length > 0){
					allTasksOk = true;
				}
			}
			
			if (successCallback && 
			allTasksOk === true && 
			unfiledOk === true){
				Mojo.Log.info("INIT SUCCESSFUL. CALLING BACK TO APP-ASSISTANT");
				if (successCallback){
					successCallback({"returnValue":true});	
				}
			}else{
				if (allTasksOk === false){
					Mojo.Log.error("FAILED Creating ALL TASKS taskList");
				}
				if (unfiledOk === false){
					Mojo.Log.error("FAILED Creating UNFILED taskList");
				}
				
				future.result={"returnValue":false, "error":"CREATE_TASKLIST_ERROR"};
				if (failCallback){
					failCallback(future.result);
				}
			}
		}else{
			future.result={"returnValue":false, "error":"FUTURE_ERROR"};
			failCallback(future.result);
		}
	};
	
/* INPUT : accountId - MojoDB _id of account
 * RETURNS STRING - LOCAL ACCOUNT ID
 */
	var _getLocalAccountId = function(){
		for (var mappingItem in kindAccountMap){
			if (kindAccountMap[mappingItem].localAccount === true){
				return mappingItem;
			}
		}
		Mojo.Log.warn("Local Account not found in account:dbkind map");
		return null;
	};
	
	var createTaskLists = function(successCallback, failCallback, createAllTasks, createUnfiled){
		Mojo.Log.info("In createTaskLists");
		var unfiledTL = {
			"objects": [{
				"_kind": constants.TASKLISTKINDUNFILED,
				"name": "Unfiled",
				"position": 0, //hard-coded
				"order": "position",
				"show": "all",
				"accountId": _getLocalAccountId(),
				"visible": false
			}]
		};
		var allTasksTL = {
			"objects": [{
				"_kind": constants.TASKLISTKINDALL,
				"name": "List all tasks",
				"position": unfiledTL.objects[0].position+constants.TASKPOSITIONSTEP,
				"order": "position",
				"dueItemCount":0,
				"show": "all",
				"accountId": _getLocalAccountId(),
				"visible": false
			}]
		};
		
		var insertAllTasksTL = {
			"method": "put",
			"params": allTasksTL
		};
		
		var insertUnfiledTL = {
			"method": "put",
			"params": unfiledTL
		};
		
		var dbCallParams = {
			"operations": []
		};
		
		if (createAllTasks === true){
			dbCallParams.operations.push(insertAllTasksTL);
		}
		
		if (createUnfiled === true){
			dbCallParams.operations.push(insertUnfiledTL);
		}		
		
		var createListFuture = PalmCall.call("palm://"+constants.PALM_DB_SERVICE_NAME+"/", "batch", dbCallParams);
		createListFuture.TASKS = {
			"successCallback": successCallback,
			"failCallback": failCallback,
			"createUnfiled": createUnfiled,
			"createAllTasks": createAllTasks
		}; //bind args to future for helper function
		createListFuture.then(this, createTaskListsHelper);
	};
	
	/* INPUT : SUCCESS CALLBACK FUNCTION IN THAT SCOPE, FAILURE CALLBACK FUNCTION IN THAT SCOPE
 * RETURNS NOTHING.
 */	
	var checkTaskLists = function(successCallback, failCallback){		
		if (unfiledTaskListId && alltasksTaskListId){ //already mapped, return
			Mojo.Log.info("UNFILED " + unfiledTaskListId + " AND ALL TASKS " + alltasksTaskListId + " ALREADY MAPPED");
	
			if (successCallback){
				successCallback();
			}
			return;
		}
		
		var findUnfiledOperation = {
			"method": "find",
			"params": {
				"query": {
					"from": constants.TASKLISTKINDUNFILED
				}
			}
		};
		var findAllTasksOperation = {
			"method": "find",
			"params": {
				"query": {
					"from": constants.TASKLISTKINDALL
				}
			}
		};
		var dbCallParams = {
			"operations": [findUnfiledOperation, findAllTasksOperation]
		};
		
		var createUnfiled = false;
		var createAllTasks = false;
		
		var checkTaskListFuture = PalmCall.call("palm://"+constants.PALM_DB_SERVICE_NAME+"/", "batch", dbCallParams);
		checkTaskListFuture.then(this, function(future){
			Mojo.Log.info("In checkTaskListFuture : " + JSON.stringify(future));
			if (future.result &&
			future.result.responses && 
			future.result.responses.length === dbCallParams.operations.length &&
			future.result.responses[0].results &&
			future.result.responses[1].results) {
				if (future.result.responses[0].results.length === 0) { //unfiled not found			
					createUnfiled = true;
				}else { //unfiled found
					unfiledTaskListId = future.result.responses[0].results[0]._id;
				}
				
				if (future.result.responses[1].results.length === 0) { //allTasks not found
					createAllTasks = true;
				}else { //allTasks found
					alltasksTaskListId = future.result.responses[1].results[0]._id;
				}
				
				if (!(createAllTasks || createUnfiled)) { //neither needs to be created
					future.result = {
						"returnValue": true
					};
					
					Mojo.Log.info("INIT SUCCESSFUL. UNFILED ALREADY EXISTS. CALLING BACK TO APP-ASSISTANT");
					if (successCallback){
						successCallback(
							{
								"returnValue": true
							}
						);
					}		
				}else { //either one or both need to be created
						createTaskLists(successCallback, failCallback, createAllTasks, createUnfiled);
				}
			}else {
				var returnResult = {
					"returnValue": false,
					"error": "FUTURE_ERROR"
				};
				future.result = returnResult;
				if (failCallback){
					failCallback(returnResult);
				}
			}
		});
	};
	
	
	var updateTotals = function(createDashboard){
		Mojo.Log.info(">>>>>>>>>>>>>>>>>>>IN UPDATETOTALS " + createDashboard);		
		checkTaskLists( //just to make sure 
			function(){
				getTaskLists(
					{},
					function(params){
						setupTotalsBatchQuery(params, createDashboard);
					}.bind(this),
					function(){
						Mojo.Log.error("ERROR getting taskLists");
					}
				); //TASK: RECONSIDER failcallback
			}.bind(this), 
			this.callFailure, 
			false
		);
	};
	
	
/* INPUT : accountId - MojoDB _id of account
 * RETURNS STRING - TASK KIND FOR THAT GIVEN ACCOUNT. IF NO ACCOUNID PROVIDED, DEFAULT constants.TASKKIND (LOCAL ACCT) IS RETURNED 
 */
	var _getKindFromAccountId = function(accountId){
		if (!(accountId)) {
			Mojo.Log.info("No argument passed to getKindFromAcccountId. Returning default taskKind");
			return constants.TASKKIND;
		}
		
		for (var mappingItem in kindAccountMap){
			if (mappingItem === accountId){
				Mojo.Log.info("Kind looked up by accountId. AccountId: " + mappingItem + " _kind:" + kindAccountMap[mappingItem].taskKind);
				return kindAccountMap[mappingItem].taskKind;
			}
		}
		Mojo.Log.info("task db kind for accountId " + accountId + " NOT FOUND.");
		//default fallback - regular task kind
		return constants.TASKKIND;
	};
	
/* INPUT : NUM - UTC EVENT TIME (string in ms)
 * RETURNS : IF TIME FALLS IN TODAY (1200am to 1159pm), TRUE; ELSE FALSE
 */
	var _isDue = function(eventTime){
		if (!eventTime){
			return false;
		}
		
		var currentDate = new Date(); // today's date
		currentDate.setHours(0); //time zeroed
		currentDate.setMinutes(0);//time zeroed
		currentDate.setSeconds(0);//time zeroed
		currentDate.setMilliseconds(0);
		
		var eventDate = new Date(eventTime); //passed date
		eventDate.setHours(0); //time zeroed
		eventDate.setMinutes(0);//time zeroed
		eventDate.setSeconds(0);//time zeroed
		eventDate.setMilliseconds(0);//time zeroed
		
		if (currentDate.getTime() == eventDate.getTime()){
			return true;
		}
		return false;
	};
	


/* INPUT : none
 * RETURNS : String with UTC timestamp as number of milliseconds from Jan 1, 1970 to now
 */			
	var getNowTimestamp = function(){
		var now = new Date(); // today's date
		return ( now.getTime() );
	};
		
/* INPUT : STRING - TASK LIST KIND
 * RETURNS BOOL - TRUE IF STRING === UNFILED TASK LIST TYPE
 */
	var isUnfiled = function (kind){
		if (kind === constants.TASKLISTKINDUNFILED){
			return true;
		}
		return false;		
	};
	
/* INPUT : STRING - TASK LIST KIND
 * RETURNS BOOL - TRUE IF STRING === ALL TASKS TASK LIST TYPE
 */
	var isAllTasks = function (kind){
		return (kind === constants.TASKLISTKINDALL);			
	};
	
/* INPUT : OBJECT - TASKLIST
 * RETURNS BOOL - TRUE IF TASKLIST._kind IS OF UNFILED TYPE
 */
	var isRegularLocalTaskList = function (taskList){
		if (taskList.accountId === _getLocalAccountId() && 
			!(isAllTasks(taskList._kind) || isUnfiled(taskList._kind)) ){
			return true;
		}
		return false;		
	};	
	
	var doAccountMapping = function(successCallback, failCallback, accountsFuture){
		//Mojo.Log.info("-------- In doAccountMapping - future = " + new Date().getTime() + " " + JSON.stringify(accountsFuture)); //DEBUG
		numEasAccounts = 0; //global
		
		var returnResult = null;
			
		var futureResult = accountsFuture.result;
		if (futureResult && futureResult.results) {
		
			var accountResults = futureResult.results;
			var accountResultsLength = accountResults.length;
			kindAccountMap = {}; //initialize kindAccountMap. Global to this class.			
			
			var localAccountExists = false;
			var accountObject = null;
			
			for (var index = 0; index < accountResultsLength; index++) {
				var account = accountResults[index];
				if (account.templateId &&
				account.templateId === "com.palm.palmprofile") { //adding local account's id to kind mapping
					accountObject = {
						"taskKind": constants.TASKKIND,
						"localAccount": true
					};
					Mojo.Log.info("Adding local accountObject to kindAccountMap : " + JSON.stringify(accountObject));
					kindAccountMap[account._id] = accountObject;
					localAccountExists = true;
					
				}
				else if (account.capabilityProviders) { //adding all other accounts capable of TASKS and which contain subKind property
					for (var capabilityIndex = 0; capabilityIndex < account.capabilityProviders.length; capabilityIndex++) {
						var capabilityProvider = account.capabilityProviders[capabilityIndex];
						
						if (capabilityProvider &&
						capabilityProvider.capability === "TASKS" &&
						capabilityProvider.subKind) {
							accountObject = {
								"taskKind": capabilityProvider.subKind
							};
							
							if (account.templateId === "com.palm.eas"){
								accountObject.email = account.username;
								numEasAccounts++;
							}
							
							if (capabilityProvider.icon &&
							capabilityProvider.icon.loc_32x32) {
								accountObject.iconLocation = capabilityProvider.icon.loc_32x32;
							}
							
							Mojo.Log.info("Adding accountObject to kindAccountMap : " + JSON.stringify(accountObject));
							kindAccountMap[account._id] = accountObject;
						}
					}
				}
			}
			Mojo.Log.info("mapAccounts: Done mapping " + accountResults.length + " accounts to kinds " + JSON.stringify(kindAccountMap));
			
			if (localAccountExists === true) {
				Mojo.Log.info("Local account exists");
				accountsFuture.result = {
					"returnValue": true
				};
				if (successCallback) {
					successCallback({
						"returnValue": true
					});
				}
			}
			else {
				Mojo.Log.error("====ERROR : NO PALM PROFILE TASKS-CAPABLE ACCOUNT FOUND (ok if seen before first use completion) ");
				returnResult = {
					"returnValue": false,
					"error": "NO_LOCAL_ACCOUNT"
				};
				accountsFuture.result = returnResult;
				if (failCallback) {
					failCallback(returnResult);
				}
			}
		} else {
			Mojo.Log.error("MapKindsToAccounts - future error");
			
			if (failCallback) {
				returnResult = {
					"returnValue": false,
					"error": "FUTURE_ERROR"
				};
				accountsFuture.result = returnResult;
				if (failCallback) {
					failCallback(returnResult);
				}
			} else {
				accountsFuture.result = {
					"returnValue": false,
					"error": "BAD_FUNCTION_PARAMS"
				};
			}
		}
	}; 
	
	var mapAccounts = function (successCallback, failCallback, subscribe){
DEBUG_TIME("IN MAPACCOUNTS - BEFORE CALL TO AccountsLib.AccountsList.ListAccounts"); //TASK: REMOVE DEBUG TIMING
		accountsSubscription = AccountsLib.AccountsList.listAccounts(
			function(accountsArray){
DEBUG_TIME("IN MAPACCOUNTS - CALLBACK FROM ACCOUNTS SUBSCRIPTION"); //TASK: REMOVE DEBUG TIMING				
Mojo.Log.info("=-=-=-=-=-=-=-=IN CALLBACK FROM ACCOUNTS LIBRARY=-=-=-=-=-=-=-= " + JSON.stringify(accountsArray));
				var accountsFauxFuture = new Foundations.Control.Future(); 
				accountsFauxFuture.result = { results : accountsArray };
				doAccountMapping(successCallback, failCallback, accountsFauxFuture);
			}.bind(this),
			{
				filterBy: {
					capability: "TASKS"
				},
				subscribe: subscribe
			}
		);
	};
	
	var hasMultipleEasAccounts = function (){
		return (numEasAccounts > 1);
	};
	
	var getEasAccountName = function(accountId){
		return kindAccountMap[accountId].email.replace( /@.*/g, '' );
	};

	var getTaskPositionIndex = function(params, successCallback, failCallback){ 
		var dbCallParams = {
			"query": {
				"from": params.kind || constants.TASKKIND,
				"orderBy":"position",
				"desc":true,
				"limit":1
			}
		};
		if (params.visible !== undefined) {
			dbCallParams.query.where = [{
				prop: "visible",
				op: "=",
				val: params.visible
			}];
		}
		Mojo.Log.info("In getTaskPositionIndex. dbCallParams: " + JSON.stringify(dbCallParams));

		var getPositionFuture = PalmCall.call("palm://"+constants.PALM_DB_SERVICE_NAME+"/", "find", dbCallParams);
		getPositionFuture.then(this, function(future){
			Mojo.Log.info("In getTaskPositionIndex. future: " + JSON.stringify(getPositionFuture));

			if ("result" in future &&
				"results" in future.result){
				var count = future.result.results.length;
				var lastPosition=0;

				if (count > 0){
					lastPosition = future.result.results[0].position;
				}
				
				var returnResult = null;
				if (successCallback) {
					returnResult = {"returnValue" : true, "index" : count, "nextPosition" : lastPosition};
					future.result = returnResult;
					successCallback(returnResult);
				}else{
					returnResult = {"returnValue" : false, "error" : "BAD_FUNCTION_PARAMS"};
					future.result = returnResult;
					failCallback(returnResult);
				}
			}else if ("exception" in future){
				var returnValue = {"returnValue" : false, "error" : "FUTURE_ERROR"};
				future.result = returnValue;
				if (failCallback) {
					failCallback(returnValue);
				}
			}
		});	
	};
	
/* INPUT : SUCCESS CALLBACK FUNCTION IN THAT SCOPE, FAILURE CALLBACK FUNCTION IN THAT SCOPE
 * RETURNS NOTHING. RESULT INFLUENCES WHICH CALLBACK GETS CALLED
 */	
	var _markNewSyncedItemPositions = function(params, successCallback, failCallback){
		Mojo.Log.info ("In markNewSyncedTaskPositions");
		
		var dbCallParams = { //find all tasks which are not of regular (ie local) _kind
			"query": {
				"from": params.kind,
				"where" : [{
					"prop": "_kind",
					"op": "!=",
					"val": params.kind
				}]
			}
		};
		
		var markFuture = PalmCall.call("palm://"+constants.PALM_DB_SERVICE_NAME+"/", "find", dbCallParams);
		markFuture.then(this, function(future){
			Mojo.Log.info ("In markNewSyncedTaskPositions - future " + JSON.stringify(future));
			
			var assignPositions = function(params){ //function assignPositions gets called back by getTaskPositionIndex with params.nextPosition
												//if finds any EAS 
				var nextPosition = params.nextPosition || new Date().getTime();
				var mergeDBCallParams = {
					"objects":[]
				};
				
				for (var item = 0; item < future.result.results.length; item++){
					if (!(future.result.results[item].position) || future.result.results[item].position === 0){
						mergeDBCallParams.objects.push({
							"_id": future.result.results[item]._id,
							"position": nextPosition - ( constants.TASKPOSITIONSTEP*(1+mergeDBCallParams.objects.length) )
						});
					}
				}	
				Mojo.Log.info("Merge DB call params for new EAS tasks positions: " + JSON.stringify(mergeDBCallParams));
				
				if (mergeDBCallParams.objects.length > 0){ //if we need to do a merge to set the positions of at least 1 task
				
					var mergeFuture = PalmCall.call("palm://"+constants.PALM_DB_SERVICE_NAME+"/", "merge", mergeDBCallParams);
					mergeFuture.then(this, function(future){
						if ("result" in future && 
							"results" in future.result &&
							future.result.results.length > 0){
								future.result = { "returnValue" : true };
						}else if ("exception" in future){
							Mojo.Log.error("Merge failed. Could not set \'position\' on synced tasks");
							mergeFuture.result = { "returnValue" : false };
						}
					});
				}
				if (successCallback){
					successCallback({"returnValue":true});	
				}
			}.bind(this);
			
			if ("result" in future && 
				"results" in future.result){
					getTaskPositionIndex(params, assignPositions, failCallback, false);
					
			}else if ("exception" in future){
				var returnResult = {"returnValue" : false, "error" : "FUTURE_ERROR"};
				future.result = returnResult;
				if (failCallback) {
					failCallback(returnResult);
				}
			}
		});
	};
	var markNewSyncedTaskPositions = _markNewSyncedItemPositions.bind(null, {kind: constants.TASKKIND});
	var markNewSyncedTaskListPositions = _markNewSyncedItemPositions.bind(null, {kind: constants.TASKLISTKIND, visible: true});
	
		
/*
 * setTasksDueDate - set the dueDate (UTC ms timestamp) on all tasks with a given taskListId.
 *                 - if not provided, set dueDate on all tasks
 * @param {Object} params : { dueDate - required, taskListId - optional }
 * @param {Object} successCallback : { handle to success method, which takes one argument }
 * @param {Object} failCallback : { handle to failure method, which takes one argument }
 * @return { "count" : <number of modified tasks> }
 */	
	var setTasksDueDate = function (params, successCallback, failCallback){
		Mojo.Log.info("In setTasksDueDate");
		
		if (!(params && params.dueDate)){
			Mojo.Log.error("ERROR: setTasksDueDate");
			failCallback({"returnValue":"ERROR: setTasksDueDate not passed any/correct arguments"});
		}
		
		var dbCallParams = { //params for merge db call
			"props": {
				"dueDate": params.dueDate
			},
			"query": {
				"from": constants.TASKKIND
			}
		};		
		
		if (params.taskListId){ //if taskListId provided
			dbCallParams.query.where = [{
				"prop": "taskListId",
				"op": "=",
				"val": params.taskListId
			}];
		}
		
		Mojo.Log.info("setTasksDueDate dbCallParams " + JSON.stringify(dbCallParams));
		var setFuture = PalmCall.call("palm://"+constants.PALM_DB_SERVICE_NAME+"/", "merge", dbCallParams);
		setFuture.then(function(setFuture){
			Mojo.Log.info("setTasksDueDate future is " + JSON.stringify(setFuture));
			if (setFuture.result &&
				setFuture.result.returnValue &&
				setFuture.result.returnValue === true){
				Mojo.Log.info("setTasksDueDate : success");
				successCallback({"count":setFuture.result.count});
				setFuture.result = {"returnValue":true};		
			} else {
				failCallback({
					"returnValue": false,
					"error": "FUTURE ERROR in setTasksDueDate"
				});
				setFuture.result = {"returnValue":false};
			}
		});
		
	};
	
	
////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////						TASKLISTS						////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////


	var saveTaskList = function(params, successCallback, failCallback){
		Mojo.Log.info("|||||||||++++++++++++++++++++++||||||||||||IN SAVETASKLIST " + JSON.stringify(params));
		var dbCallParams = {"objects":[{}]};
		if (params){
			for (var param in params){
				if (param === "id" && params.id !== null) {
					dbCallParams.objects[0]._id = params[param];
				}else if (param === "order" && params[param] === "dueDate"){
					dbCallParams.objects[0][param] = "duedate"; // overwrite order:dueDate with order:duedate
				}else if (param === "_kind"){
					//ignore _kind or merge will result in the creation of a taskList of _kind: super
				}else{
					dbCallParams.objects[0][param] = params[param];
				}
			}
			if (!(params.id)){ //no id given, so new tasklist (implicitly local)
				dbCallParams.objects[0].accountId = _getLocalAccountId();
				dbCallParams.objects[0]._kind = constants.TASKLISTKIND; 
			}
			if (!(params.dueItemCount)){
				dbCallParams.objects[0].dueItemCount = 0;
			}
		}else{
			if (failCallback){
				failCallback("No params passed");
			}else{
				return null;
			}
		}
		
		Mojo.Log.info("||||||||||||||||||||||\n\n " + JSON.stringify(dbCallParams));
		var saveTaskListFuture = PalmCall.call("palm://"+constants.PALM_DB_SERVICE_NAME+"/", "merge", dbCallParams);
		saveTaskListFuture.then(this,function(){
			Mojo.Log.info("||||||||||||||||||||||\n\n saveTaskList : merge " + JSON.stringify(saveTaskListFuture));
			if ("result" in saveTaskListFuture &&
				"results" in saveTaskListFuture.result &&
				"id" in saveTaskListFuture.result.results[0]){
					successCallback({
						"id": saveTaskListFuture.result.results[0].id
					});
			}else if ("exception" in saveTaskListFuture){
				failCallback(saveTaskListFuture.exception);	
			}
		});
	};
	
	
	var deleteTaskList = function(params, successCallback, failCallback){
		Mojo.Log.info("|||||||||||||||||||||| IN DELETETASKLIST " + JSON.stringify(params));
		var dbCallParams = {
			"operations": [{
				"method" : "del",
				"params": {
					"query": {
						"from": constants.TASKKIND,
						"where": [{
							"prop": "taskListId",
							"op": "=",
							"val": ( params.id === getUnfiledTaskListId() ) ? null : params.id
						}]
					}
				}
			},{
				"method": "del",
				"params": {
					"query": {
						"from": constants.TASKLISTKIND,
						"where": [{
							"prop": "_id",
							"op": "=",
							"val": params.id
						}]
					}
				}
			}]
		};
		
		var deleteTaskFuture = PalmCall.call("palm://"+constants.PALM_DB_SERVICE_NAME+"/", "batch", dbCallParams);
		deleteTaskFuture.then(this, function(){
			Mojo.Log.info("|||||||||||||||||||||| IN DELETETASKLIST - responsefuture " + JSON.stringify(deleteTaskFuture));
			if ("result" in deleteTaskFuture){
				successCallback(deleteTaskFuture.result);
			}else if ("exception" in deleteTaskFuture){
				failCallback(deleteTaskFuture.exception);	
			}
		});
	};
	
		
	var getTaskList = function(params, successCallback, failCallback){ 
		Mojo.Log.info("IN GETTASKLIST " + JSON.stringify(params));
		
		if ( !("id" in params) ){
			if (failCallback) {
				failCallback("wrong params");
			} else{
				return null;
			}
		}
		var dbCallParams = {
			"query": {
				"from": constants.TASKLISTKIND,
				"where":[{
					"prop": "_id",
					"op": "=",
					"val": params.id
				}]
			}
		};

		Mojo.Log.info("|||||||||||||GET TASK LIST dbcallparams" + JSON.stringify(dbCallParams));	
		var getTaskListFuture = PalmCall.call("palm://"+constants.PALM_DB_SERVICE_NAME+"/", "find", dbCallParams);
		getTaskListFuture.then(function(){
			Mojo.Log.info("|||||||||||||||GET TASK LIST future" + JSON.stringify(getTaskListFuture));	

			if ("result" in getTaskListFuture && 
				"results" in getTaskListFuture.result &&
				getTaskListFuture.result.results.length == 1){
					
				var returnResult = getTaskListFuture.result.results[0];
				returnResult.id = returnResult._id;
				delete returnResult._id;
				
				if (returnResult.completed === true){
					returnResult.completed = "1";
				}else{
					returnResult.completed = "0";
				}
				
				if (isEasAccount(returnResult.accountId) && ( returnResult.name === "Tasks")){ // || returnResult.name === "Exchange" )){
					returnResult.name = $L('Exchange');
//					if (hasMultipleEasAccounts() === false) {
//						returnResult.name = $L('Exchange');
//					}else{
//						returnResult.name = ($L('Exchange') + "-" + getEasAccountName(returnResult.accountId));
//					}
				}	
				
				if (isEasAccount(returnResult.accountId)){
					returnResult.flags = 65536;
				}else if (returnResult._kind === constants.TASKLISTKINDUNFILED){
					returnResult.flags = 1;
				}else if (returnResult._kind === constants.TASKLISTKIND){
					returnResult.flags = 0;	
				}else{
					returnResult.flags = null;
				}
			
				Mojo.Log.info("getTaskList ----- " + JSON.stringify(returnResult));
			
				if (successCallback) {
					if (successCallback){
						successCallback(returnResult);
					}
				}else{
					return returnResult;
				}	
			}else if ("exception" in getTaskListFuture){
				if (failCallback) {
					failCallback(getTaskListFuture.exception);
				} else{
					return null;
				}	
			}
		});		
	};
	
	
	var _saveTask = function _saveTask(saveDbCallParams, successCallback, failCallback, mergeEnable){
		var mergeOrPut = "merge";
		if (mergeEnable && mergeEnable === false){ //ideally should always be merge. MojoDB is currently unable to merge deleted un-purged objects
			mergeOrPut = "put";
		}
		
		var saveTaskFuture = PalmCall.call("palm://"+constants.PALM_DB_SERVICE_NAME+"/", mergeOrPut, saveDbCallParams);
		saveTaskFuture.then(this, function(){
			Mojo.Log.info("||||||||||||||||||||||\n\n saveTask : merge " + JSON.stringify(saveTaskFuture));
			if ("result" in saveTaskFuture &&
				"results" in saveTaskFuture.result &&
				"id" in saveTaskFuture.result.results[0]){
					successCallback({
						"id": saveTaskFuture.result.results[0].id
					});
			}else if ("exception" in saveTaskFuture){
				successCallback(saveTaskFuture.exception);	
			}
		});
	};
	

	var saveTask = function saveTask(params, successCallback, failCallback){ 
		var saveDbCallParams = { //some properties are set to null or other values just to guarantee their existence in the db. some of these will be overwritten later in function.
			objects: [{
				_kind: constants.TASKKIND,
				subject: "",
				notes: "",
				completed: false,
				completedDate: null,
				priority: 2,
				dueDate: null,
				position: undefined,
				taskListId: null //null defaults to unfiled 
			}]
		};
		Mojo.Log.info("|||||||||||||||||||||| SAVETASK1 saveDbCallParams" + JSON.stringify(saveDbCallParams));
		var batchOperations = [];
		
		if (params){
			Mojo.Log.info("==========SETTING properties for saveDbCallParams");
			for (var param in params){
				if (param){//jslint
					if (param === "id" && params.id){
						saveDbCallParams.objects[0]._id = params.id;
					}if (param === "taskListId" && params.taskListId === getUnfiledTaskListId()){
						saveDbCallParams.objects[0].taskListId = null;
					}else{
						saveDbCallParams.objects[0][param] = params[param] ? params[param] : saveDbCallParams.objects[0][param];
					}
				}
			}
			
			if (params.completedDate !== null && params.completed === false) { //clear completedDate if moving to completed=false
				saveDbCallParams.objects[0].completedDate = null;
			}
			else if ( (!(params.completedDate) || params.completedDate === null) && params.completed === true) { //set completedDate if moving to completed=true
				saveDbCallParams.objects[0].completedDate = (new Date()).getTime();	
			}
			
			Mojo.Log.info("|||||||||||||||||||||| SAVETASK params" + JSON.stringify(params));
			Mojo.Log.info("|||||||||||||||||||||| SAVETASK saveDbCallParams" + JSON.stringify(saveDbCallParams));
			
//			if (params.taskListId){ //task already assigned to TaskList (params have taskList property)
				batchOperations.push({
					"method": "get",
					"params": {
						"ids": [params.taskListId ? params.taskListId : getUnfiledTaskListId()]
					}
				});
				
				if (params.id){ //task already exists in db (params already have id)
					batchOperations.push({
						"method": "get",
						"params": {
							"ids": [params.id]
						}
					});
				}
				
				var batchFuture = PalmCall.call("palm://" + constants.PALM_DB_SERVICE_NAME + "/", "batch", {"operations":batchOperations});
				batchFuture.then(this, function(){
					Mojo.Log.info("|||||||||||||||||||||| SAVETASK batchFuture" + JSON.stringify(batchFuture));
					var batchResult = batchFuture.result;
					var existingTaskList = (batchResult.responses[0].results) ? (batchResult.responses[0].results[0]) : null;
					var newTaskKind = _getKindFromAccountId(existingTaskList ? existingTaskList.accountId : getUnfiledTaskListId());
					saveDbCallParams.objects[0]._kind = newTaskKind;
					if (params.id) {
						var existingTask = batchFuture.result.responses[1].results[0];
						
						if (existingTask._kind != newTaskKind) {
							Mojo.Log.info("Deleting old item of kind " + existingTask._kind);
							
							var deleteFuture = PalmCall.call("palm://" + constants.PALM_DB_SERVICE_NAME + "/", "del", {"ids":[params.id]});
							deleteFuture.then( function(){
								Mojo.Log.info("||||||||||||| _saveTask savedbcallparams " + JSON.stringify(saveDbCallParams));
								delete saveDbCallParams.objects[0]._id;
								_saveTask(saveDbCallParams, successCallback, failCallback, false);
							});
						}else{
							_saveTask(saveDbCallParams, successCallback, failCallback);
						}
					}
					else {
						_saveTask(saveDbCallParams, successCallback, failCallback);
					}
				});
//			}else{
//				saveDbCallParams.objects[0].taskListId = null; //unfiled
//				_saveTask(saveDbCallParams, successCallback, failCallback);
//			}
		}else{
			failCallback({"returnValue":false});
		}
	};
	
	
	var getTask = function(params, successCallback, failCallback){ 
		var dbCallParams = {
			"query": {
				"from": constants.TASKKIND
			}
		};
		
		if (params){
			for (var param in params){
				if (param === "id"){
					dbCallParams.query.where = [{
						"prop": "_id",
						"op": "=",
						"val": params[param]
					}];
				}
			}
		}
Mojo.Log.info("||||||||||||||||||||||GET TASK params" + JSON.stringify(params));
Mojo.Log.info("||||||||||||||||||||||GET TASK dbcallparams" + JSON.stringify(dbCallParams));

		
		var getTaskFuture = PalmCall.call("palm://"+constants.PALM_DB_SERVICE_NAME+"/", "find", dbCallParams);
		getTaskFuture.then(function(){
Mojo.Log.info("|||--|||--|||--|||GET TASK" + JSON.stringify(getTaskFuture));	

			if ("result" in getTaskFuture &&
				"results" in getTaskFuture.result){
				
				var returnResult = {
					"due": _isDue(getTaskFuture.result.results[0].dueDate),//false,//getTaskFuture.result.results[0], ////!!?!?@@?!#?!@?#
					"priority": getTaskFuture.result.results[0].priority,
					"position": getTaskFuture.result.results[0].position,
					"id": getTaskFuture.result.results[0]._id,
					"notes": getTaskFuture.result.results[0].notes,
					"completed": getTaskFuture.result.results[0].completed,
					"subject": getTaskFuture.result.results[0].subject,
					"taskListId" : getTaskFuture.result.results[0].taskListId,
					"dueDate": (getTaskFuture.result.results[0].dueDate || null)
				};
				
				var success = function(params){
					successCallback(returnResult);
				};				
				var fail = function(params){
					failCallback("failure getting taskList information in getTask");
				};
				Mojo.Log.info ("|||||||||    CALL TO GETTASKLIST " + JSON.stringify({"id":getTaskFuture.result.results[0].taskListId || unfiledTaskListId}));
				getTaskList({"id":getTaskFuture.result.results[0].taskListId || unfiledTaskListId},success.bind(this), fail.bind(this));		

			}else if ("exception" in getTaskFuture){
				failCallback(getTaskFuture.exception);	
			}
		});		
	};
	
	
	var deleteTask = function (params, successCallback, failCallback){
		var dbCall2Params = {
			"query": {
				"from": constants.TASKKIND,
				"where": [{
					"prop": "_id",
					"op": "=",
					"val": params.id
				}]
			}
		};
		
		Mojo.Log.info("||||||||||||||||||||||\n\n " + JSON.stringify(dbCall2Params));

		
		var deleteTaskFuture = PalmCall.call("palm://"+constants.PALM_DB_SERVICE_NAME+"/", "del", dbCall2Params);
		deleteTaskFuture.then(function(){
			if ("result" in deleteTaskFuture && 
				deleteTaskFuture.result.count > 0){
				deleteTaskFuture.result={"returnValue":true};
				if (successCallback) {
					successCallback(deleteTaskFuture.result);
				}
			}else if ("exception" in deleteTaskFuture){
				deleteTaskFuture.result={"returnValue":false};
				if (failCallback) {
					failCallback(deleteTaskFuture.exception);
				}	
			}
		});
	};
	
	
	var purgeCompletedTasks = function(params, successCallback, failCallback){
		var dbCallParams = {
			"query": {
				"from": constants.TASKKIND,
				"where": []
			}
		};
		
		if (params.taskListId) {
			dbCallParams.query.where.push({
				"prop": "taskListId",
				"op": "=",
				"val": ( params.taskListId === getUnfiledTaskListId() ) ? null : params.taskListId
			});
		}
		dbCallParams.query.where.push({
			"prop": "completed",
			"op": "=",
			"val": true
		});
		
Mojo.Log.info("||||||||||||||||||||||\n\n " + JSON.stringify(dbCallParams));

		var deleteTaskFuture = PalmCall.call("palm://"+constants.PALM_DB_SERVICE_NAME+"/", "del", dbCallParams);
		deleteTaskFuture.then(function(){
			if ("result" in deleteTaskFuture){
				successCallback(deleteTaskFuture.result);
			}else if ("exception" in deleteTaskFuture){
				failCallback(deleteTaskFuture.exception);	
			}
		});
	};

	
	var markTasksCompleted = function(params, successCallback, failCallback){
		Mojo.Log.info("||||||||||||||||||||||MarkComplete call params " + JSON.stringify(params));
		var dbCallParams = {
			"props":{
				"completed":true,
				"completedDate" : getNowTimestamp()
			},
			"query": {
				"from": constants.TASKKIND,
				"where": []
			}
		};
		
		if (params.taskListId) {
			dbCallParams.query.where.push({
				"prop": "taskListId",
				"op": "=",
				"val": (params.taskListId === getUnfiledTaskListId()) ? null :params.taskListId
			});
		}
		
		dbCallParams.query.where.push({
			"prop": "completed",
			"op": "=",
			"val": false
		});
		
		Mojo.Log.info("||||||||||||||||||||||MarkComplete dbParams " + JSON.stringify(dbCallParams));

		var markTaskFuture = PalmCall.call("palm://"+constants.PALM_DB_SERVICE_NAME+"/", "merge", dbCallParams);
		markTaskFuture.then(function(){
			if ("result" in markTaskFuture){
				successCallback({"count":markTaskFuture.result.count});
			}else if ("exception" in markTaskFuture){
				failCallback(markTaskFuture.exception);	
			}
		});
	};
	
	
	var markTasksIncomplete = function(params, successCallback, failCallback){
		Mojo.Log.info("||||||||||||||||||||||MarkComplete call params " + JSON.stringify(params));
		var dbCallParams = {
			"props":{
				"completed":false,
				"completedDate":null
			},
			"query": {
				"from": constants.TASKKIND,
				"where": []
			}
		};
		
		if (params.taskListId) {
			dbCallParams.query.where.push({
				"prop": "taskListId",
				"op": "=",
				"val": (params.taskListId === getUnfiledTaskListId()) ? null :params.taskListId
			});
		}
		
		dbCallParams.query.where.push({
			"prop": "completed",
			"op": "=",
			"val": true
		});
		
		var markTaskFuture = PalmCall.call("palm://"+constants.PALM_DB_SERVICE_NAME+"/", "merge", dbCallParams);
		markTaskFuture.then( function(){
			if ("result" in markTaskFuture){
				successCallback({"count":markTaskFuture.result.count});
			}else if ("exception" in markTaskFuture){
				failCallback(markTaskFuture.exception);	
			}
		});
	};
	
	var _shiftTasks = function (tasksArray, firstDueTaskIndex){
		if (firstDueTaskIndex > 0) {
		
			var newArray = [];
			for (var item = firstDueTaskIndex; item < tasksArray.length; item++) {
				newArray.push(tasksArray[item]);
			}
			
			for (var index = 0; index < firstDueTaskIndex; index++) {
				newArray.push(tasksArray[index]);
			}
			
			Mojo.Log.info("||||||||||||||| array in func " + JSON.stringify(newArray));
			return newArray;
		}
		return tasksArray;
	};
	
	var mergeBatch = function ( batch, successCallback, failCallback ){
		Mojo.Log.info("|||-BATCH TRANSACTIONS LIST- " + JSON.stringify(batch));
				
		var future = PalmCall.call("palm://"+constants.PALM_DB_SERVICE_NAME+"/", "merge", {"objects":batch});
		future.then(this, function(){
			if (future.result && future.result.results && future.result.results.length){
				Mojo.Log.info ("MOVE FUTURE PASS ===========" + JSON.stringify(future));
				if (successCallback){
					successCallback({"returnValue":true});
				}
			}else if (failCallback){
				failCallback({"returnValue":false});
			}
		});
	};
	
	var attachPositions = function(tasks){
		var highestPosition = null;
		var index;
		
		for (index = 0; index < tasks.length; index++){
			if (tasks[index].position && 
				tasks[index].position > highestPosition){
				highestPosition = tasks[index].position;
			}
		}
		
		if (!highestPosition){
			highestPosition = 0;
		}
		
		var objectsToMerge = []; //for those which need to be marked with position
		
		for (index = 0; index < tasks.length; index++){
			if (! (tasks[index].position)){
				tasks[index].position = (highestPosition + ( (index+1)*constants.TASKPOSITIONSTEP) );
				objectsToMerge.push({"_id":tasks[index]._id, "position":tasks[index].position});
			}
		}
		
		mergeBatch(objectsToMerge);

		return tasks;
	};
	
	var watchTasksChanges = function(taskListId, callback){
		var dbCallParams = {
			query: {
				from: constants.TASKKIND,
				limit:0
			},
			count:true,
			watch:true
		};
		
		if (taskListId !== alltasksTaskListId){
			dbCallParams.query.where = [{
					prop: "taskListId",
					op: "=",
					val: ( taskListId === unfiledTaskListId ) ? null : taskListId
			}];
		}
		if (this.watchTasksFuture && typeof(this.watchTasksFuture === "Future")){
			this.watchTasksFuture.cancel();
		}
		this.watchTasksFuture = PalmCall.call("palm://"+constants.PALM_DB_SERVICE_NAME+"/", "find", dbCallParams);
		this.watchTasksFuture.then(this, function(future){});
		this.watchTasksFuture.then(this, function(future){
			if (future.result.fired && future.result.fired === true){
				callback();
			}
		});
	};
	
	var stopWatchingTasksChanges = function(){
		if (this.watchTasksFuture && typeof(this.watchTasksFuture === "Future")){
			this.watchTasksFuture.cancel();
		}
	};
	
	var _processRetrievedTasks = function(resultsArray, params, successCallback, failCallback){
		var tasks = attachPositions(resultsArray);
		
		if ( (params.what && params.what == "remaining") || (params.filter) ) { //remove all completed items from returned array
			var upTo = tasks.length;
			var myFilter = ""; //had to create because params was not found in scope when nested deeper
			if (params.filter){
				myFilter=params.filter;
			}
			for (var item = 0; item < upTo; item++) {
				Mojo.Log.info("item " + item + "  upTo " + upTo);
				if ( (params.what === "remaining" && tasks[item].completed && tasks[item].completed === true) || 
				( ( myFilter && myFilter.length > 0 && tasks[item].subject.toLowerCase()).indexOf( myFilter.toLowerCase() ) == -1) ){
					tasks.splice(item, 1);
					upTo = tasks.length;
					item--;
				}
			}
		}
		
		var firstDueTaskIndex = -1; //index of first item going up the array, that has a dueDate!=null
		var index;
		
		for (index = 0; index < tasks.length; index++){
			if (! (tasks[index].dueDate)){
				tasks[index].dueDate = null;	
			}					
			if (tasks[index]._id) {
				tasks[index].id = tasks[index]._id;
				delete tasks[index]._id;
			}
			if (tasks[index].dueDate && firstDueTaskIndex === -1){ // if firstDueTaskIndex is out of range (not set) and dueDate!=null
				firstDueTaskIndex = index;//set firstDueTaskIndex
			}
			if (tasks[index].completed) {
				if (tasks[index].completed === true){
					tasks[index].completed = "1";
				}else{
					tasks[index].completed = "0";
				}											
			}
		}
		
		var reorderedTasksArray = resultsArray;
		if (params.order === "duedate") {
			reorderedTasksArray = _shiftTasks(resultsArray, firstDueTaskIndex);
		}
		
		if (params.offset > 0){
			reorderedTasksArray = reorderedTasksArray.slice(params.offset);
		}
		if (params.limit > 0){
			reorderedTasksArray = reorderedTasksArray.slice(0, params.limit);
		}
		
		var returnResult = {
			"list": reorderedTasksArray,
			"count": resultsArray.length,
			"offset": params.offset,
			"limit": params.limit
		};
		
		Mojo.Log.info("GETTASKS returning:" + JSON.stringify({
			count: returnResult.count,
			limit: returnResult.limit,
			offset: returnResult.offset
		}));
		successCallback(returnResult);			
	};
	
	var _getAllTasks = function(future, resultsArray, params, dbCallParams, successCallback, failCallback){
		var result = future.result;
		if (result.results){
			if (result.next && result.results.length > 0){
				dbCallParams.query.page = result.next;
				resultsArray = resultsArray.concat(result.results);
				future.nest(PalmCall.call("palm://"+constants.PALM_DB_SERVICE_NAME+"/", "find", dbCallParams));
				future.then(this, function(future){
					_getAllTasks(future, resultsArray, params, dbCallParams, successCallback, failCallback);
				});
			}else{
				resultsArray = resultsArray.concat(result.results);
				_processRetrievedTasks(resultsArray, params, successCallback, failCallback);
			}
		}else{
			future.result = null;
			failCallback();
		}
	};

	var getTasks = function(params, successCallback, failCallback){ 
		Mojo.Log.info("GETTASKS params:" + JSON.stringify(params));
		var dbCallParams = {
			"query": {
				"from": constants.TASKKIND
			}
		};
		if (params){
			if (params.taskListId){
				dbCallParams.query.where = [{
					"prop": "taskListId",
					"op": "=",
					"val": params.unfiledFlag ? null : params.taskListId
				}];
			}
			if (params.order){
				if (params.order == "duedate"){
					dbCallParams.query.orderBy = "dueDate";
					dbCallParams.query.desc = false;
				}else if(params.order == "position"){
					dbCallParams.query.orderBy = "position";
					dbCallParams.query.desc = false;
				}else if(params.order == "priority"){
					dbCallParams.query.orderBy = "priority";
					dbCallParams.query.desc = false;
				}
			}			
		}

		Mojo.Log.info("GETTASKS dbCall:" + JSON.stringify(dbCallParams));		
		var getTasksFuture = PalmCall.call("palm://"+constants.PALM_DB_SERVICE_NAME+"/", "find", dbCallParams);
		getTasksFuture.then(this, function(future){
			_getAllTasks(future, [], params, dbCallParams, successCallback, failCallback);
		});	
	};
	
	var moveTaskLists2 = function( itemIndex, beforeItemIndex, taskLists, successCallback, failCallback ){
		var arSize = taskLists.length;
		var modifiedArray = []; //array of {_id:<string>, position:<int>} of taskLists whose positions will be adjusted
		var taskList = null;
		
		if (beforeItemIndex === null){ //no beforeIndex ie moving to the very bottom 
			taskList = taskLists[ itemIndex ];
			if (constants.TASKLISTS_POSITION_DESCENDING === true){
				taskList.position = taskLists [ arSize - 1 ].position - 1000;	
			}else{
				taskList.position = taskLists [ arSize - 1 ].position + 1000;
			}				
			modifiedArray.push( taskList );
		}else{
			if (beforeItemIndex === 0){ //move to first
				taskList = taskLists[ itemIndex ];
				if (constants.TASKLISTS_POSITION_DESCENDING === true){
					taskList.position = taskLists[0].position + 1000;	
				}else{
					taskList.position = taskLists[0].position - 1000;
				}				
				modifiedArray.push( taskList );
			}else{ //move between beforeItem and the previous item
				var mustBatchMove = false;
				if (Math.floor (Math.abs((taskLists[beforeItemIndex].position - taskLists[beforeItemIndex - 1].position)/2) <= 1) ) { //if beforeItem and the previous one are integer-adjacent or same, move all starting with beforeItem down 1000
					mustBatchMove = true;
					for (var i = beforeItemIndex; i < arSize; i++) {
						taskList = taskLists[i];
						if (constants.TASKLISTS_POSITION_DESCENDING === true) {
							taskList.position -= 1000;
						}
						else {
							taskList.position += 1000;
						}
						modifiedArray.push(taskList);
					}
				}
				
				taskList = taskLists[ itemIndex ];
	
				var leftTaskList = taskLists[ beforeItemIndex - 1 ];
				var rightTaskList = taskLists[ beforeItemIndex ];
				if (mustBatchMove === true){ //if rightTaskList (at beforeItemIndex)'s position changes
					rightTaskList = modifiedArray[ 0 ]; //get its new position
				}
				
				taskList.position = Math.floor(( leftTaskList.position + rightTaskList.position ) / 2);
				modifiedArray.push( taskList );
			}
		}			
		mergeBatch( modifiedArray, successCallback, failCallback );
	};
	
	var moveTaskList = function(params, successCallback, failCallback){
		if (!params || !(params.items) || (params.items.length != 1) || !(params.beforeItem)) { //check funcation call input params
			failCallback({
				"returnValue": false,
				"execption": "Move taskList - wrong args"
			});
		}
		Mojo.Log.info("MoveTaskList params " + JSON.stringify(params));
		var itemId = params.items[0]._id;
		var beforeItemId = null;
		
		if (params.beforeItem.beforeModel) {
			beforeItemId = params.beforeItem.beforeModel._id;
		}
		
		var returnedTaskListsArray = [];
		var returnedTaskListsCount = 0;
		var beforeItemIndex = null;
		var itemIndex = null;
		
		var query = {
				"from": constants.TASKLISTKIND,
				"where": [{
					"prop": "visible",
					"op": "=",
					"val": true
				}],
				"orderBy": "position",
				"desc": constants.TASKLISTS_POSITION_DESCENDING //MUST BE SAME AS IN GETTASKLISTS
		};
		
		var getAllTaskLists = function(future){
			if (future.result && future.result.returnValue && (future.result.returnValue === true )){ //check that future has all the right 
				var taskLists = future.result.results;
				returnedTaskListsCount += taskLists.length;
				
				for (var i = 0; i < taskLists.length; i++){
					Mojo.Log.info("adding item " + i + " of " + taskLists.length + " of total so far: " + returnedTaskListsCount);
					returnedTaskListsArray.push ({"_id":taskLists[i]._id, "position":taskLists[i].position});
					if (taskLists[i]._id === beforeItemId){
						beforeItemIndex = returnedTaskListsArray.length-1;
					}else if (taskLists[i]._id === itemId){
						itemIndex = returnedTaskListsArray.length-1;
					}					
				}
			}else{ //future came back with error
				future.result = {"returnValue" : false};
				failCallback({"returnValue":false}); //TASK: check mem leak
			}
			
			if (future.result.next){ //if over the one-shot mojodb return limit (future.result.next exists), call self again to add the rest of the results to list 
				Mojo.Log.info("--------GETTING NEXT BATCH OF TASKLISTS FROM DB");
				
				var newQuery = query;
				newQuery.page = future.result.next;
				future.result = {"returnValue" : true};
				var newFuture=PalmCall.call("palm://"+constants.PALM_DB_SERVICE_NAME+"/", "find", {
					"query": newQuery
				});
				newFuture.then(this, getAllTaskLists);				
			}
			else{
				Mojo.Log.info("=================== ABOUT TO CALL moveTaskLists2=============");
				future.result = {"returnValue" : true};
				moveTaskLists2 (itemIndex, beforeItemIndex, returnedTaskListsArray, successCallback, failCallback);
			}
		};
		
		var future = PalmCall.call("palm://"+constants.PALM_DB_SERVICE_NAME+"/", "find", {
			"query": query
		});
		future.then(this, getAllTaskLists);
	};
	
	var moveTask = function (params, successCallback, failCallback){
		//params = { id, taskListid, filter, what, fromIndex, toIndex }
	
		var success = function (params){
			if (successCallback) {
				return successCallback(params);
			}else {
				return params;
			}
		};
		var failure = function (params){
			if (failCallback) {
				return failCallback(params);
			}else {
				return null;
			}
		};
		if (!params || !(params.toIndex) || !(params.fromIndex) || !(params.id)){
			failure({
					"returnValue": false,
					"execption": "Move task - wrong args"
				});
		}
		
		var toIndex = params.toIndex;
		var fromIndex = params.fromIndex;
		var beforePosition = 0;
		var dbCallParams = {
			"query": {
				"from": constants.TASKKIND,
				"orderBy": "position",
				"desc": constants.TASKS_POSITION_DESCENDING
			}
		};
		
		if (params.taskListId){
			dbCallParams.query.where=[{
				"prop": "taskListId",
				"op": "=",
				"val": params.taskListId
			}];
		}
		
		var future = PalmCall.call("palm://"+constants.PALM_DB_SERVICE_NAME+"/", "find", dbCallParams); //DESCENDING: MUST BE SAME AS IN GETTASKS
		
		future.then(this, function(){
			if (future.result && future.result.results && future.result.results.length > 0){
				
				if ( (params.what && params.what == "remaining") || (params.filter) ) { //remove all completed items from returned array
					var upTo = future.result.results.length;
					for (var item = 0; item < upTo; item++) {
						if ( (future.result.results[item].completed && future.result.results[item].completed === true) ||
						(future.result.results[item].complete && future.result.results[item].complete === true) || 
						( (future.result.results[item].subject.toLowerCase()).indexOf((params.filter).toLowerCase()) == -1) ){
							future.result.results.splice(item, 1);
							upTo = future.result.results.length;
							item--;
						}
					}
				}
				var batch = [];
				
	///////////////////////////////////////////////////
	//inner function moveDown
	//input: myLists - array of task items
	//input: myBatch - array of items for merge query. 
	//items that need to be repositioned will be included
	//into array as {_id:X, position:newposition}
	//idea: going down the array of items [0->..], moves 
	//idea: items which are <1001 apart from next neighbor
	//idea: down 1000. stops at first item which is >=1001 apart
				 
				var moveDown = function (myLists, myBatch){
	//Mojo.Log.info("|||||||||||||||||||||||||||||||||||||||||||||||||| BEFORE LISTS");
	//for (var i=0; i<myLists.length; i++){ Mojo.Log.info("|||-LIST- " + myLists[i].name)};					
					
					for (var item=0; item < myLists.length; item++){
						myBatch.push({"_id":myLists[item]._id, "position":myLists[item].position + constants.TASKPOSITIONSTEP}); //ADDITION IF ASCENDING ORDER
						
						if ((item == (myLists.length-1)) || Math.abs(myLists[item].position - myLists[item+1].position) >= (constants.TASKPOSITIONSTEP+1)){ //if current is not last && current and next are >= 1001 apart
							break;
						}//if last or dist>1001 break
					}
	//Mojo.Log.info("|||||||||||||||||||||||||||||||||||||||||||||||||| AFTER LISTS");				
	//for (var i=0; i<myLists.length; i++){ Mojo.Log.info("|||-LIST- " + myLists[i].name)};	
				};
				
				var totalListCount = future.result.results.length;
				var lists = future.result.results;
				
				if (toIndex === 0) { //to very top
	//Mojo.Log.info("|||||||||||||||||||||||||||||||||||||||||||||||||| TO TOP ");
					batch.push({"_id":params.id, "position":lists[toIndex].position - constants.TASKPOSITIONSTEP}); //first task's index - 1000 (ASSUMING ASC ORDER)
				}else if (toIndex == (totalListCount-1)){ //to very bottom
	//Mojo.Log.info("|||||||||||||||||||||||||||||||||||||||||||||||||| TO BOTTOM ");
					batch.push({"_id":params.id, "position":lists[toIndex].position + constants.TASKPOSITIONSTEP}); //last task's index + 1000 (ASSUMING ASC ORDER)
				}else{ //somewhere between
	//Mojo.Log.info("|||||||||||||||||||||||||||||||||||||||||||||||||| ABS " + Math.abs(lists[toIndex-1].position - lists[toIndex].position));
	//Mojo.Log.info("|||||||||||||||||||||||||||||||||||||||||||||||||| LISTS " + JSON.stringify(lists));
					var left=0;
					var right=0;
					if (fromIndex < toIndex){ //down
						left = toIndex;
						right = toIndex+1;
					}else{ //up
						left=toIndex-1;
						right=toIndex;
					}
					if ( Math.abs(lists[left].position - lists[right].position) < 2){ //"distance" between toIndex-1 and toIndex is <2 
						if ( fromIndex > toIndex ){
	//Mojo.Log.info("|||||||||||||||||||||||||||||||||||||||||||||||||| MOVEUP > ");
							beforePosition = lists[toIndex-1].position;
							lists.splice(fromIndex,1);
							lists.splice(0,toIndex);
							moveDown(lists, batch); //items which are positioned between self and toPosition, INCLUDING toPosition item
						}else{
	//Mojo.Log.info("|||||||||||||||||||||||||||||||||||||||||||||||||| MOVEDOWN <= ");
							lists.splice(0,toIndex+1);
							moveDown(lists, batch); //items which are positioned between self and toPosition, INCLUDING toPosition item
							beforePosition = lists[lists.length-1].position;
						}
						
						batch.push({
							"_id": params.id,
							"position": Math.floor((beforePosition + batch[0].position) / 2)
						});
					}else{ //distance between toIndex-1 and toIndex is >=2
	//Mojo.Log.info("|||||||||||||||||||||||||||||||||||||||||||||||||| DISTANCE >=2 ");
						batch.push({"_id":params.id, "position":Math.floor((lists[left].position + lists[right].position)/2)});			
					}
				}
				
	//Mojo.Log.info("|||-BATCH TRANSACTIONS LIST- " + JSON.stringify(batch));
					
				var dbMovePositionFuture = PalmCall.call("palm://"+constants.PALM_DB_SERVICE_NAME+"/", "merge", {"objects":batch});
				dbMovePositionFuture.then(this, function(){
					if (dbMovePositionFuture.result && dbMovePositionFuture.result.results && dbMovePositionFuture.result.results.length){
						success("moveTask : " + JSON.stringify(dbMovePositionFuture.result.results));
					}else{
						failure("moveTask : Cannot execute DB merge statement");
					}
				});
			
			}else{
				failure({
					"returnValue": false,
					"execption": "Move Task - No tasks found"
				});
			}
		});
	};
	
	var addTaskListName = function (params, successCallback, failCallback, context){
		
		var dbCallParams = {
			"query": {
				"from": constants.TASKLISTKIND,
				"where":[{
					"prop": "_id",
					"op": "=",
					"val": params[params.length-1].taskListId ? params[params.length-1].taskListId : unfiledTaskListId
				}]
			}
		};
		
		var future = PalmCall.call("palm://"+constants.PALM_DB_SERVICE_NAME+"/", "find", dbCallParams);
		future.then(this,function(){
			Mojo.Log.info("|||--|||--|||--|||addTaskListName future" + JSON.stringify(future));	
			if (future && future.result && 
			future.result.results && future.result.results.length == 1){
				
				params[params.length-1].taskListName = future.result.results[0].name;
				
				if (future.result.results[0]._kind === constants.TASKLISTKINDEAS){
					if (params[params.length-1].taskListName === "Tasks"){ // || 
					//params[params.length-1].taskListName === "Exchange"){
						params[params.length-1].taskListName = $L ("Exchange");
//						if (hasMultipleEasAccounts() === false) {
//							params[params.length-1].taskListName = $L('Exchange');
//						}else{
//							params[params.length-1].taskListName = ($L('Exchange') + " - " + getEasAccountName(future.result.results[0].accountId));
//						}
					}
				}	
				
				Mojo.Log.info ("RETURNING TASKS ARRAY " + JSON.stringify(params));
				var returnResult = params;
				future.result = {"returnValue":true};
				successCallback.apply(context, [returnResult]);
			}else{
				future.result = {"returnValue":false, "error":"FUTURE ERROR: top notification's taskList not found"};
				failCallback.apply(context, []);
			}
		});
	};
	
	var getDueTasksAsArray = function(params, successCallback, failCallback, context){ 
		var dbCallParams = {
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
					"val": getEndOfDayTimestamp()
				}]
			}
		};
		Mojo.Log.info("|||--|||--|||--|||getDueTasksAsArray dbcallparams" + JSON.stringify(dbCallParams));	
		var future = PalmCall.call("palm://"+constants.PALM_DB_SERVICE_NAME+"/", "find", dbCallParams);
		future.then(this,function(){
			Mojo.Log.info("|||--|||--|||--|||getDueTasksAsArray future" + JSON.stringify(future));	

			var returnResult = [];
			if ("result" in future && 
				"results" in future.result){
					
					returnResult = future.result.results;
					
					for (var i=0; i < returnResult.length; i++){
						if (returnResult[i].taskListId === null){
							returnResult[i].taskListId = unfiledTaskListId;
						}
					}
					future.result = {"returnValue":true};
					if (returnResult.length > 0) {
						addTaskListName(returnResult, successCallback, failCallback, context);
					}else{
						successCallback.apply(context, [returnResult]);
					}
				
			}else if ("exception" in future){
				future.result = {"returnValue":false};	
				failCallback.apply(context, []);
			}
		});		
	};
	
	var isSubscribedToAccounts = function(){
		return ( accountsSubscription ? true : false );
	};
	
	var quickMapLocalAccount = function(successCallback, failCallback){
		var dbCallParams = {
			"query": {
				"from": constants.ACCOUNTKIND
			}
		};
		var future = PalmCall.call("palm://"+constants.PALM_DB_SERVICE_NAME+"/", "find", dbCallParams);
		future.then(this,function(){
			if (future.result && future.result.results && future.result.results.length > 0){
				var results = future.result.results;
				for (var i=0; i<results.length; i++){
					if (results[i].templateId === "com.palm.palmprofile"){
						kindAccountMap[results[i]._id] = {
							"taskKind": constants.TASKKIND,
							"localAccount": true
						};
						break;
					}
				}
				future.result = true;
				if (successCallback){
					successCallback();
				}
			}else{
				if (failCallback){
					failCallback();
				}
			}
		});
	};
	
	var markUnfiledVisibility = function(visible, successCallback){
		var mergeParams = {
			objects: [{
				_id: getUnfiledTaskListId(),
				visible: visible
			}]
		};
		Mojo.Log.info("Unfiled visibility state changing " + JSON.stringify(mergeParams));
		
		var future = PalmCall.call("palm://"+constants.PALM_DB_SERVICE_NAME+"/", "merge", mergeParams);
		future.then(this, function(future){
			if ("result" in future &&
				"results" in future.result){
				future.result = {"returnValue":true};
				
				if (successCallback) {
					successCallback();
				}
			}else{
				if (successCallback) {
					successCallback();
				}
			}
		});	
	};
	
	var _handleUnfiledCountResponse = function(future, successCallback){
		if (future.exception){
			successCallback();
		}else if (future.result){
			if (future.result.count){
				markUnfiledVisibility((future.result.count > 0), successCallback);
			}else{
				markUnfiledVisibility(false, successCallback);
			}
		}
	};
	
	var checkUnfiledVisibility = function(successCallback){
		var dbQuery = {
			"query": {
				"from": "com.palm.task:1",
				"where": [{
					"prop": "taskListId",
					"op": "=",
					"val": null
				}],
				"limit": 0
			},
			"count": true
		};
		
		var future =  PalmCall.call("palm://"+constants.PALM_DB_SERVICE_NAME+"/", "find", dbQuery);
		future.then(function(future){
			_handleUnfiledCountResponse(future, successCallback);
		});
	};	
	
	return {
		"isUnfiled":isUnfiled,
		"isAllTasks":isAllTasks,
		"isRegularLocalTaskList":isRegularLocalTaskList,
		"mapAccounts":mapAccounts,
		"markNewSyncedTaskPositions":markNewSyncedTaskPositions,
		"markNewSyncedTaskListPositions":markNewSyncedTaskListPositions,
		"checkTaskLists":checkTaskLists,
		"setTasksDueDate":setTasksDueDate,
		"saveTaskList":saveTaskList,
		"deleteTaskList":deleteTaskList,
		"getTaskLists":getTaskLists,
		"getTaskList":getTaskList,
		"saveTask":saveTask,
		"getTask":getTask,
		"deleteTask":deleteTask,
		"purgeCompletedTasks":purgeCompletedTasks,
		"markTasksCompleted":markTasksCompleted,
		"markTasksIncomplete":markTasksIncomplete,
		"getTasks":getTasks,
		"getTaskPositionIndex":getTaskPositionIndex,
		"moveTaskList":moveTaskList,
		"moveTask":moveTask,
		"getIconFromAccountId":getIconFromAccountId,
		"isEasAccount":isEasAccount,
		"updateTotals":updateTotals,
		"getUnfiledTaskListId":getUnfiledTaskListId,
		"getAllTasksTaskListId":getAllTasksTaskListId,
		"getDueTasksAsArray":getDueTasksAsArray,
		"getEndOfDayTimestamp":getEndOfDayTimestamp,
		"hasMultipleEasAccounts":hasMultipleEasAccounts,
		"getEasAccountName":getEasAccountName,
		"isSubscribedToAccounts":isSubscribedToAccounts,
		"quickMapLocalAccount":quickMapLocalAccount,
		"checkUnfiledVisibility":checkUnfiledVisibility,
		"watchTasksChanges":watchTasksChanges,
		"stopWatchingTasksChanges":stopWatchingTasksChanges
	};
	
}





	
