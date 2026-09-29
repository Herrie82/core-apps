/*jslint laxbreak: true, white: false, devel: true */
/*global Class: false, Mojo: false, $L: false, Template: false, Event: false, 
 Form: false, db: false, Weave: false, State: false, TaskList: false, Foundations: false,
 constants:false, DEBUG_TIME:false*/

/* Copyright 2009 Palm, Inc.  All rights reserved. */

var TasklistsAssistant = Class.create({
    initialize: function(){
    },
    
    activate: function(event){
        DEBUG_TIME("ACTIVATE CALLED"); //TASK: REMOVE DEBUG TIMING	
		//this.controller.listen(this.list, Mojo.Event.filterImmediate, this.handleFilter.bind(this), true);
        this.controller.listen(this.list, Mojo.Event.filter, this.handleFilter.bind(this), true);
		db.checkUnfiledVisibility();
    },
    
    deactivate: function(){
        //this.controller.stopListening(this.list, Mojo.Event.filterImmediate, this.handleFilter.bind(this), true);
        this.controller.stopListening(this.list, Mojo.Event.filter, this.handleFilter.bind(this), true);
    },
    
	setupListAllTasks: function(){
		var listAllParams = {
            kind: constants.TASKLISTKINDALL,
            makeWhere: function(filterString){return [];},
            watch: true,
			watchDelay:100
        };
        
        this.dsAllAssistant = new Mojo.DataSource.TypedownDBDataSourceAssistant(listAllParams);
		this.dataAllSource = new Mojo.DataSource(this.dsAllAssistant);
		
		this.controller.setupWidget("groupListAll", {
            templates: {
                item: "tasklists/tasklist-entry",
				empty: 'tasklists/tasklist-entry',
				nullItem: 'tasklists/tasklist-entry'
            },
            dataSource: this.dataAllSource,
			decorator: this.decorate.bind(this),
            reorderable: false,
			uniquenessProperty: "_id"
        }, {});
		
		this.allTasksList = this.controller.get('groupListAll');
        this.allTasksList.observe(Mojo.Event.listTap, this.handleTap.bindAsEventListener(this));
		this.allTasksList.observe(Mojo.Event.listDelete, this.handleDelete.bindAsEventListener(this));
	},
	
	setupListRegular: function(){
		 var listParams = {
            kind: constants.TASKLISTKIND,
            makeWhere: this.getWhereClause,
            watch: true,
			watchDelay:100,
            orderBy: "position",
            desc: true
        };
        
        this.dsAssistant = new Mojo.DataSource.TypedownDBDataSourceAssistant(listParams);
		
		this.dsAssistant.reorderItems = function(items, callback, beforeItem) {
			if(items.length === 1){
				if ( ! (items && items.length == 1 && callback && beforeItem) ){//missing a parameter
					callback({returnValue: false});
					return;
				}
				
				var moveTaskListParams = {
					items: items,
					beforeItem: beforeItem
				};
				
				db.moveTaskList(moveTaskListParams, //mark taskLists in db 
				function(){
					if (callback) {
						callback({
							returnValue: true
						});
					}
				}, function(){
					if (callback) {
						callback({
							returnValue: false
						});
					}
				});

				// callback({returnValue: true}); //PASS THIS TO REORDER routine in DB
			} else {
				Mojo.Log.info(">>>>>>>>>>>>>>>>REORDER: To be implemented: handling a reorder array the size of", items.length);
				if (callback) {
					callback({
						returnValue: false
					});
				}
			}
		}.bind(this);
        
		this.dataSource = new Mojo.DataSource(this.dsAssistant);
        
		this.controller.setupWidget("groupList", {
            templates: {
                item: "tasklists/tasklist-entry",
				empty: 'tasklists/tasklist-entry',
				nullItem: 'tasklists/tasklist-entry'
            },
            dataSource: this.dataSource,
            asyncDecorator: this.asyncDecorate.bind(this),
			decorator: this.decorate.bind(this),
			swipeDelete: {
                autoConfirm: false,
                preventProperty: 'nodelete'
            },
            reorderable: true,
			uniquenessProperty: "_id"
        }, {});
		
		this.list = this.controller.get('groupList');
        this.list.observe(Mojo.Event.listTap, this.handleTap.bindAsEventListener(this));
		this.list.observe(Mojo.Event.listDelete, this.handleDelete.bindAsEventListener(this));
	},
	
    setup: function(){
		DEBUG_TIME("SETUP CALLED"); //TASK: REMOVE DEBUG TIMING	
	    //--////--Mojo.Log.info('TasklistsAssistant::setup %s');
        // Whole scene
        this.sceneElement = this.controller.get('tasks-groups');
        // Set up a command menu
        this.controller.setupWidget(Mojo.Menu.commandMenu, {
            menuClass: 'task-lists'
        }, {
            items: [{
                icon: "new-list-button",
                command: 'add'
            }]
        });
        
        //MOJO2
        Mojo.Log.info('TasklistsAssistant::setup %s');
		
		this.setupListRegular();
		this.setupListAllTasks();	
		
		DEBUG_TIME("SETUP - END"); //TASK: REMOVE DEBUG TIMING
    },
	
	getWhereClause: function(filterString){
		var whereClause = [];
		whereClause.push({
                prop: "visible",
                op: "=",
                val: true
		});

	    if (filterString) {
			whereClause.push({
                prop: "name",
                op: "?",
                val: filterString,
				collate:"primary"
            });
        }
        Mojo.Log.info("WHERECALUSE " + JSON.stringify(whereClause));
        return whereClause;
    },
    
    highlightMatchText: function(s, p1){
        var result = "<span class='list-highlight'>";
        if (p1[0] !== this.filterString[0]) {
            result = p1[0] + result + p1.substr(1);
        }
        else {
            result += p1;
        }
        result += "</span>";
        return result;
    },
	
	pinIcons: function(items){
		var taskList = null;
		var iconLocation = null;
		for (taskList = 0; taskList < items.length; taskList++){
			iconLocation = db.getIconFromAccountId(items[taskList].accountId);
			if (iconLocation){
				items[taskList].iconLocation = iconLocation;
				items[taskList].iconPresent = iconLocation ? 'block' : 'none'; //set icon presence flag
			}	
		}
		return items;
	},
	
	asyncDecorate: function(items, callback){
		var cancelFlag = false; //true if canceled
		
		if (! db.isSubscribedToAccounts() ){
			db.mapAccounts(
				function(){
					items = this.pinIcons(items);
					if (!cancelFlag){
						callback(items);						
					}
				}.bind(this),
				function(){
					Mojo.Log.error("ERROR: failure to map accounts");
				}, 
				true
			);
		}else{
			items = this.pinIcons(items);
			if (!cancelFlag){
				callback(items);	
			}
		}
		
		return {
			cancel : function(){
				cancelFlag = true;
			}.bind(this)
		};
    },

    decorate: function(item, filterString){
		if (db.isUnfiled(item._kind) || db.isAllTasks(item._kind)){ //Localize 'Unfiled' and 'All Tasks'
			item.name = $L(item.name);
		}
		
		if (item._kind === constants.TASKLISTKINDEAS){
			if (item.name === "Tasks"){ // || item.name === "Exchange"){
				item.name = $L('Exchange');
//				if (db.hasMultipleEasAccounts() === false) {
//					item.name = $L('Exchange');
//				}else{
//					item.name = ($L('Exchange') + " - " + db.getEasAccountName(item.accountId));
//				}
			}
		}	
		
		if (this.filterString) {
            var pos = 0;
            var ndx = -1;
            var lcInput = item.name.toLowerCase();
            var lcFilter = this.filterString.toLowerCase();
            var lcLeadingWordFilter = " " + lcFilter;
            item.nameFormatted = "";
            
            if (Foundations.StringUtils.startsWith(lcInput, lcFilter)) {
                item.nameFormatted += "<span class='list-highlight'>";
                item.nameFormatted += item.name.substring(pos, lcFilter.length);
                item.nameFormatted += "</span>";
                pos = lcFilter.length;
            }
            
            do {
                ndx = lcInput.indexOf(lcLeadingWordFilter, pos);
                if (ndx === -1) {
                    item.nameFormatted += item.name.substring(pos, item.name.length);
                }
                else {
                    item.nameFormatted += item.name.substring(pos, ndx + 1);
                    item.nameFormatted += "<span class='list-highlight'>";
                    item.nameFormatted += item.name.substring(ndx + 1, ndx + lcLeadingWordFilter.length);
                    item.nameFormatted += "</span>";
                }
                pos = ndx + lcLeadingWordFilter.length;
            }
            while (ndx !== -1);
            
        }
        else {
            item.nameFormatted = item.name;
//          Mojo.Log.info("NO FILTERSTRING. SETTING nameFormatted to name property= " + item.name); //TASK: uncomment    
        }
        
        item.dueItemCountFormatted = item.dueItemCount;
        item.classFormatted = '';
        
        //Set up nodelete for All Tasks & Unfiled
        item.nodelete = !(TaskList.isDeleteable(item));
        
        if (item.dueItemCount | 0) {
            item.classFormatted += " due";
        }
        
        item.unreadTagRotation = Math.round(Math.random() * 10) - 5;
        
        if (item.order === "dueDate") {
            item.order = "duedate";
        }
        
		var iconLocation = db.getIconFromAccountId(item.accountId); //get icon location string or null
					
		if (iconLocation){
			item.iconLocation = iconLocation;
			item.iconPresent = iconLocation ? 'block' : 'none'; //set icon presence flag
		}		
		
        return item;
    },
    
    cleanup: function(){
        this.list.stopObserving(Mojo.Event.listTap, this.handleTap.bindAsEventListener(this));
		this.list.stopObserving(Mojo.Event.listDelete, this.handleDelete.bindAsEventListener(this));
				
		//--////--Mojo.Log.info('TasklistsAssistant::cleanup');
        if (State.taskList) {
            State.taskList.removeUpdateListener(this);
        }
        State.listOfLists.removeUpdateListener(this);
    },
    
    handleFilter: function(event){
        this.filterString = event.filterString;
		if (this.filterString){
			this.list.mojo.open();
		}else{
			this.list.mojo.close();
		}
		
    },
    
    handleTap: function(event){
        var item = event.item;
        if (item) {
            this._openList(item);
            Event.stop(event);
        }
    },
    
    _setCurrentList: function(item){
        State.taskList = item;
    },
    
    _openList: function(item){
		item.id = item._id;
		if (!item.order){
			item.order = "position";
		}
        this._setCurrentList(new TaskList(item));
        this.controller.stageController.pushScene('tasks');
    },
    
    handleDelete: function(event){
		(new TaskList(event.item).remove(this));
    },
    
    handleCommand: function(event){
        // Handle the add menu item
        if (event.type == Mojo.Event.command && event.command == 'add') {
            //--////--Mojo.Log.info("add");
			this._openList({
                position: new Date().getTime()
            });
            Event.stop(event);
        }
    }
});
