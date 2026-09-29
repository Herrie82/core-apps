/*jslint laxbreak: true, white: false, devel: true */
/*global Class: false, Mojo: false, $L: false, Template: false, Event: false, Form: false, Task: false, TaskList: false, Weave: false, State: false, DatePickerAssistant: false, db: false, Element: false*/

/* Copyright 2009 Palm, Inc.  All rights reserved. */

var TasksAssistant = Class.create({
	
    initialize: function()
	{
       Mojo.Log.info('TasksAssistant::initialize %s');
    },
    
    setup: function()
	{
        //--Mojo.Log.info('TasksAssistant::setup %j %s', State.taskList);
		// Handlers
		this.handleTap = this.handleTap.bind(this);
		this.handleTapCapture = this.handleTapCapture.bind(this);
		this.handleHoldCapture = this.handleHoldCapture.bind(this);
		this.handleDelete = this.handleDelete.bind(this);
		this.handleReorder = this.handleReorder.bind(this);
		this.onTaskChanged = this.onTaskChanged.bind(this);
		this.handleFilter = this.handleFilter.bind(this);
		this.taskListNameChanged = this.taskListNameChanged.bind(this);
		this.showOrderChanged = this.showOrderChanged.bind(this);
		this.onKey = this.onKey.bind(this);
		this.onTaskBlur = this.onTaskBlur.bind(this);
		this.onTaskListName = this.onTaskListName.bind(this);
		this.onTaskListEnterKey = this.onTaskListEnterKey.bind(this);
		this._onSceneDeactivate = this._onSceneDeactivate.bind(this);
		this._stopScrolling = this._stopScrolling.bind(this);
        
        // Whole scene
        this.sceneElement = this.controller.get('tasks-list');

        // Task list
        var taskList = State.taskList;
		this.taskList = taskList;
		this.modifiedTaskList = 
		{ 
			name: taskList.name, 
			show: taskList.show ? taskList.show : "all", 
			order: taskList.order ? taskList.order : "position",
			_disabled: (TaskList.isUnfiled(taskList) || TaskList.isAllTasks(taskList)) 
		};

		var iconLocation = db.getIconFromAccountId(taskList.accountId); //get icon location string or null
				
		if (iconLocation){ 
			var showIcon = iconLocation ? 'block' : 'none';
			var cssText = "background: url(" + iconLocation +") center center no-repeat; display: " + showIcon + ";";
			this.controller.get('taskListTransportIcon').style.cssText = cssText;
		}
		
		this.nameFieldAttr={
            hintText: $L('List name'),
            textFieldMode: 'sentence-case',
            requiresEnterKey: true,
			changeOnKeyPress: true,
			modelProperty: 'name',
			disabledProperty: '_disabled',
			focus: TaskList.isNew(taskList),
			focusMode: Mojo.Widget.focusAppendMode
        };

        this.controller.setupWidget('taskListName',this.nameFieldAttr, this.modifiedTaskList);
        this.taskListNameElement = this.controller.get('taskListName');
        this.taskListNameElement.observe(Mojo.Event.propertyChanged, this.taskListNameChanged);
        this.taskListNameElement.observe('keyup', this.onTaskListEnterKey);
		if (!this.modifiedTaskList._disabled) 
		{
			this.taskListNameElement.observe(Mojo.Event.tap, this.onTaskListName);
		}     

        this.listAttr =
		{
            itemTemplate: 'tasks/task-entry',
			dividerTemplate: 'tasks/tasks-divider',
			dividerFunction: this._itemsDividers.bind(this),
            swipeToDelete: true,
            focusMode: Mojo.Widget.focusInsertMode,
            reorderable: true,
			uniquenessProperty: 'id',
            formatters: {
                dummy: this.formatItem.bind(this)
            },
			fixedHeightItems: true,
            itemsCallback: this.itemsCallback.bind(this),
			lookahead: 50,
			renderLimit: 200,
			scrollThreshold: 52 * 200 / 4
        };
		this.controller.setupWidget('taskList', this.listAttr, {});

		this.controller.setupWidget('tasks_scroller', 
			{
				mode: 'vertical'
			}
		);
        
        this.listElement = this.controller.get('taskList');
        this.listElement.observe(Mojo.Event.listTap, this.handleTap);
		this.listElement.addEventListener(Mojo.Event.tap, this.handleTapCapture, true);
		this.listElement.addEventListener(Mojo.Event.hold, this.handleHoldCapture, true);
        this.listElement.observe(Mojo.Event.listDelete, this.handleDelete);
        this.listElement.observe(Mojo.Event.listReorder, this.handleReorder);
        this.listElement.observe(Mojo.Event.propertyChange, this.onTaskChanged);
		this.listElement.observe('keyup', this.onKey);
		this.listElement.observe('DOMFocusOut', this.onTaskBlur);
		
        this.controller.setupWidget('completed', { modelProperty: 'completed' });

        // Filter
		this._filterState = { disabled: true };
        this.controller.setupWidget('filterField', {}, this._filterState);
        this.filterFieldElement = this.controller.get('filterField');
        this.filterFieldElement.observe(Mojo.Event.filter, this.handleFilter);
		
        // Subject
        this.controller.setupWidget('subject',
		{
            hintText: $L('Task name...'),
            modelProperty: 'titleFormatted',
            textFieldMode: 'sentence-case',
            requiresEnterKey: true,
			changeOnKeyPress: true,
			focusMode: Mojo.Widget.focusAppendMode
        });
		
		// Set up a command menu
        this.controller.setupWidget(Mojo.Menu.commandMenu, {menuClass: "no-fade"}, 
		{
            items: 
			[
				{
					icon: 'new-task-button',
	                command: 'add'
	            }
			]
        });
       
		// App Menu
		var self = this;
		this._appmenu = new Weave.Utilities.AppMenu(this).addEdit()
			.addItem($L('Set due date for all...'), this.handleSetDueDateCmd.bind(this))
			.addSubMenu($L('Mark All'))
				.addItem($L('Mark all completed'), this.handleMarkCompletedCmd.bind(this))
				.addItem($L('Mark all incomplete'), this.handleMarkIncompleteCmd.bind(this))
			.popSubMenu()
			.addItem(this.modifiedTaskList.show == 'all' ? $L('Hide Completed') : $L('Show Completed'), this.handleHideShowCompletedCmd.bind(this))
			.addItem($L('Delete completed tasks'), this.handlePurgeCompletedCmd.bind(this))
			.addItem($L('Delete list'), this.handleDeleteListCmd.bind(this), function(event)
			{
				// Disable Delete list command for special lists
				return TaskList.isDeleteable(self.taskList);
			})
			.addHelp();
        
        /*
         * Ordering
         */
        this.controller.setupWidget('showFilter', 
		{
			modelProperty: "order",
			choices: [
			{
				label: $L('My Order'),
				value: 'position'
			}, 
			{
				label: $L('Due Date'),
				value: 'duedate'
			}, 
			{
				label: $L('Priority'),
				value: 'priority'
			}]
		}, this.modifiedTaskList);
        this.controller.listen('showFilter', Mojo.Event.propertyChange, this.showOrderChanged);
		
		// Stop scrolling whenever we type
		this.controller.sceneElement.addEventListener('keydown', this._stopScrolling, true);
		
		// Initialize state machine
		if (TaskList.isNew(taskList))
		{
			// For new lists we start in rename state (since the first thing we do is give it a name)
			this.state = this.states.rename;
			// We make a new list as untouched until someone does something to it.  If it remains untouched we'll never save it
			this._untouched = true;
		}
		else if (State.task)
		{
			this.state = this.states.push;
			this.setCurrentTask(State.task);
		}
		else
		{
			this.state = this.states.idle;
			this._enableFilter(true);
		}		
    },
	
	cleanup: function(params)
	{
	    //--Mojo.Log.info('TasksAssistant::cleanup');
		
		this.taskListNameElement.stopObserving(Mojo.Event.propertyChanged, this.taskListNameChanged);
        this.taskListNameElement.stopObserving('keyup', this.onTaskListEnterKey);
		this.taskListNameElement.stopObserving(Mojo.Event.tap, this.onTaskListName);
		this.listElement.stopObserving(Mojo.Event.listTap, this.handleTap);
		this.listElement.removeEventListener(Mojo.Event.tap, this.handleTapCapture, true);
		this.listElement.removeEventListener(Mojo.Event.hold, this.handleHoldCapture, true);
        this.listElement.stopObserving(Mojo.Event.listDelete, this.handleDelete);
        this.listElement.stopObserving(Mojo.Event.listReorder, this.handleReorder);
        this.listElement.stopObserving(Mojo.Event.propertyChange, this.onTaskChanged);
		this.listElement.stopObserving('keyup', this.onKey);
		this.filterFieldElement.stopObserving(Mojo.Event.filter, this.handleFilter); 
		
		this._onSceneDeactivate();
		
		// Cleanup models (if we didnt delete it already)
		if (this.task) 
		{
			this.task.removeUpdateListener(this);
		}
		this.taskList.removeExternalUpdateListener(this);
	},
	
	tasksChangesFired : function(){
		db.watchTasksChanges(this.taskList._id, this.tasksChangesFired.bind(this));
		this.invalidateList();
	},

	observerWatchTasksChanges : function(){
		if (this.taskList && this.taskList._id){
			db.watchTasksChanges(this.taskList._id, this.tasksChangesFired.bind(this));
		}
	},

	activate: function(arg)
	{
	    Mojo.Log.info('TasksAssistant::activate');
		// Watch for when we go into card view
		this.controller.document.addEventListener(Mojo.Event.stageDeactivate, this._onSceneDeactivate);
		
		// Blur out self so filtering will work immediately
		if (this.state != this.states.rename){
			this._blurCurrent();
		}
		
		this.state.activate.call(this);
		this.showOrderChanged({"value":this.taskList.order, "untouched":true}); //by default list attribute 'reorderable' must be true. this call checks (and fixes) whether the list items should be reorderable on first load, BUT do not consider the fresh taskList modified by user (will not lead to saving the TL) 
		
		if (!(this.taskList.id)) { 
			this.taskListNameElement.mojo.focus();
		}else{
			this.controller.setInitialFocusedElement(this.controller.get("taskList"));
		}
		
		this.observerWatchTasksChanges();
	},
	
	deactivate: function()
	{
		this.controller.document.removeEventListener(Mojo.Event.stageDeactivate, this._onSceneDeactivate);
		db.stopWatchingTasksChanges();
	},
	
	/**************************************************************/
	/* State machine */
	
	state: null,
	
	states: 
	{		
		idle: 
		{
			_name: 'idle',
			
			reset: function()
			{
				Mojo.Log.info("====STATE MACHINE IDLE.RESET");
			},
			
			add: function()
			{
				Mojo.Log.info("====STATE MACHINE IDLE.ADD");
				this.state = this.states.adding;
				Mojo.Log.info("====STATE MACHINE NOW IN " + this.state._name + " STATE");
				this.addItem(null);
			},
			
			edit: function()
			{
				Mojo.Log.info("====STATE MACHINE IDLE.EDIT");
			},
			
			back: function()
			{
				Mojo.Log.info("====STATE MACHINE IDLE.BACK");
				// Pop the scene.
				this.state = this.states.pop;
				//this._enableFilter(false);
				this._popScene();
			},
			
			enter: function()
			{
				Mojo.Log.info("====STATE MACHINE IDLE.ENTER");
			},
			
			blur: function()
			{
				Mojo.Log.info("====STATE MACHINE IDLE.BLUR");
			},
			
			select: function(node, item)
			{
				Mojo.Log.info("====STATE MACHINE IDLE.SELECT");
				Mojo.assert(this.task === null, 'Attempting to assign to this.task which isnt null');
				this.setCurrentTask(new Task(item));
				this.addWidgets(node, item);
				//this._enableFilter(false);
				this.state = this.states.editing;
			},
			
			sync: function()
			{
				Mojo.Log.info("====STATE MACHINE IDLE.SYNC");
				this.checkSync(true);
			},
			
			selectname: function()
			{
				Mojo.Log.info("====STATE MACHINE IDLE.SELECTNAME");
				this.state = this.states.rename;
				//this._enableFilter(false);
			},
			
			listloaded: function()
			{
				Mojo.Log.info("====STATE MACHINE IDLE.LISTLOADED");
			},
			
			activate: function()
			{
				Mojo.Log.info("====STATE MACHINE IDLE.ACTIVATE");
			}
		},
		
		adding:
		{
			_name: 'adding',
			
			reset: function()
			{
				Mojo.Log.info("====STATE MACHINE ADDING.RESET");
				if (!this.saveCurrentTask()) 
				{
					// If there we no changes to commit, then we remove the task
					this.listElement.mojo.noticeRemovedItems(this.getListIndexByItem(this.task), 1);
				}
				else
				{
					this._fadeTaskIfComplete(this.task, this.modifiedTask);
				}
				this.setCurrentTask(null);
				this.state = this.states.idle;
				this.checkSync();
			},
			
			add: function()
			{
				Mojo.Log.info("====STATE MACHINE ADDING.ADD");
				this.state.enter.call(this);
			},
			
			back: function()
			{
				Mojo.Log.info("====STATE MACHINE ADDING.BACK");
				// If the current task is saved (ie. worth saving) then we pop back to the main screen.
				// Otherwise we just we 'reset' which will remove the current entry and stay on this screen.
				if (this.saveCurrentTask())
				{
					// Pop the scene.
					this.state = this.states.pop;
					this._popScene();
				}
				else
				{
					this.state.reset.call(this);
				}
			},
			
			enter: function()
			{
				Mojo.Log.info("====STATE MACHINE ADDING.ENTER");
				this._fadeTaskIfComplete(this.task, this.modifiedTask);
				var currentTask = this.task;
				if (this.saveCurrentTask())
				{
					// If we commit changes, then we create a new task and automatically.
					this.setCurrentTask(null);
					this.addItem(currentTask);
				}
				else
				{
					// Otherwise we just stay with the current task and ignore this.
					var index = this.getListIndexByItem(currentTask);
					this.listElement.mojo.revealItem(index);
					this.listElement.mojo.focusItem(currentTask);
					//--Mojo.Log.info("NOSAVE %j %d", currentTask, index);
				}
			},
			
			blur: function()
			{
				Mojo.Log.info("====STATE MACHINE ADDING.BLUR");
				this.state.reset.call(this);
			},
			
			select: function(node, item)
			{
				Mojo.Log.info("====STATE MACHINE ADDING.SELECT");
				if (this.task != item) 
				{
					this.state.reset.call(this);
				}
			},
			
			edit: function()
			{
				Mojo.Log.info("====STATE MACHINE ADDING.EDIT");
				// If you push keys and tap fast enough, you can sometimes edit a task
				// before its finished saving - so currentTask is null.  We ignore these
				// attempted edits.
				if (this.task) 
				{
					this.state = this.states.push;
					this.editCurrentTask();
				}
			},
			
			setsubject: function(subject)
			{
				Mojo.Log.info("====STATE MACHINE ADDING.SETSUBJECT");
				this.modifiedTask.subject = subject;
			},
			
			setcompleted: function(completed)
			{
				Mojo.Log.info("====STATE MACHINE ADDING.SETCOMPLETED");
				this.modifiedTask.completed = completed;
				// Put the focus back on the text field
				this.listElement.mojo.focusItem(this.task);
				this.state.reset.call(this);
			},
			
			sync: function()
			{
				Mojo.Log.info("====STATE MACHINE ADDING.SYNC");
				this._needsync = true;
			},
			
			selectname: function()
			{
				Mojo.Log.info("====STATE MACHINE ADDING.SELECTNAME");
			},
			
			listloaded: function()
			{
				Mojo.Log.info("====STATE MACHINE ADDING.LISTLOADED");
				//--Mojo.Log.info("LISTLOADED - adding item");
				this.addItem(null);
			}
		},
		
		editing:
		{
			_name: 'editing',
			
			reset: function()
			{
				Mojo.Log.info("====STATE MACHINE EDITING.RESET");
				this._fadeTaskIfComplete(this.task, this.modifiedTask);
				this.saveCurrentTask();
				this.setCurrentTask(null);
				this.state = this.states.idle;
				this.checkSync();
				this._blurCurrent();
			},
			
			add: function()
			{
				Mojo.Log.info("====STATE MACHINE EDITING.ADD");
				this.state.enter.call(this);
			},
			
			back: function()
			{
				Mojo.Log.info("====STATE MACHINE EDITING.BACK");
				this.state.reset.call(this);
			},
			
			enter: function()
			{
				Mojo.Log.info("====STATE MACHINE EDITING.ENTER");
				this._fadeTaskIfComplete(this.task, this.modifiedTask);
				var currentTask = this.task;
				this.saveCurrentTask();
				this.setCurrentTask(null);
				this.addItem(currentTask);
				this.state = this.states.adding;
			},
			
			blur: function()
			{
				Mojo.Log.info("====STATE MACHINE EDITING.BLUR");
				this.state.reset.call(this);
			},
			
			select: function(node, item)
			{
				Mojo.Log.info("====STATE MACHINE EDITING.SELECT");
				if (this.task.id !== item.id || this.task.subject !== item.subject) 
				{
					this.saveCurrentTask();
					// Select the new task
					this.setCurrentTask(new Task(item));
					this.addWidgets(node, item);
					this.listElement.mojo.focusItem(item);
				}
			},
			
			edit: function()
			{
				Mojo.Log.info("====STATE MACHINE EDITING.EDIT");
				this.saveCurrentTask();
				this.state = this.states.push;
				this.editCurrentTask();
			},
			
			setsubject: function(subject)
			{
				Mojo.Log.info("====STATE MACHINE EDITING.SETSUBJECT");
				this.modifiedTask.subject = subject;
			},
			
			setcompleted: function(completed, target)
			{
				Mojo.Log.info("====STATE MACHINE EDITING.SETCOMPLETED");
				this.modifiedTask.completed = completed;
				// Give up the focus and go idle
				this.state.reset.call(this);
			},
			
			sync: function()
			{
				Mojo.Log.info("====STATE MACHINE EDITING.SYNC");
				this._needsync = true;
			},
			
			selectname: function()
			{
				Mojo.Log.info("====STATE MACHINE EDITING.SELECTNAME");
				this.state = this.states.rename;
			},
			
			listloaded: function()
			{
				Mojo.Log.info("====STATE MACHINE EDITING.LISTLOADED");
				var index = this.getListIndexByItem(this.task);
				if (index !== undefined) 
				{
					this.listElement.mojo.noticeUpdatedItems(index, [this.task]);
					this.listElement.mojo.revealItem(index);
					this.addWidgets(this.listElement.mojo.getNodeByIndex(index).querySelector('[name="subject"]'), this.task);
					this.listElement.mojo.focusItem(this.task);
				}
				else 
				{
					this.state = this.states.idle;
					this.checkSync();
				}
			}
		},
		
		rename:
		{
			_name: 'rename',
			
			reset: function()
			{
				Mojo.Log.info("====STATE MACHINE RENAME.RESET");
				this.state = this.states.idle;
				//this._enableFilter(true);
				this._blurCurrent();
			},
			
			add: function()
			{		
				Mojo.Log.info("====STATE MACHINE RENAME.ADD");	
				this._untouched = false; // If we add an item from an untouched, we become touched
				this.addItem(null);
				this.state = this.states.adding;
			},
			
			back: function()
			{
				Mojo.Log.info("====STATE MACHINE RENAME.BACK");
				// Pop the scene.
				this.state = this.states.pop;
				this._popScene();
			},
			
			enter: function()
			{
				Mojo.Log.info("====STATE MACHINE RENAME.ENTER");
				this.state.add.call(this);
			},
			
			blur: function()
			{
				Mojo.Log.info("====STATE MACHINE RENAME.BLUR");
				this.state.reset.call(this);
			},
			
			select: function(node, item)
			{
				Mojo.Log.info("====STATE MACHINE RENAME.SELECT");
				Mojo.assert(this.task === null, 'Attempting to assign to this.task which isnt null');
				this.setCurrentTask(new Task(item));
				this.addWidgets(node, item);
				this.state = this.states.editing;
			},
			
			edit: function()
			{
				Mojo.Log.info("====STATE MACHINE RENAME.EDIT");
			},
			
			sync: function()
			{
				Mojo.Log.info("====STATE MACHINE RENAME.SYNC");
				this.checkSync(true);
			},
			
			selectname: function()
			{
				Mojo.Log.info("====STATE MACHINE RENAME.SELECTNAME");
			},
			
			listloaded: function()
			{
				Mojo.Log.info("====STATE MACHINE RENAME.LISTLOADED");
			},
			
			activate: function()
			{
				Mojo.Log.info("====STATE MACHINE RENAME.ACTIVATE");
			}
		},
		
		push:
		{
			_name: 'push',
			
			reset: function()
			{
				Mojo.Log.info("====STATE MACHINE PUSH.RESET");
			},
			
			activate: function()
			{
				Mojo.Log.info("====STATE MACHINE PUSH.ACTIVATE");
				this.setCurrentTask(null);
				this.state = this.states.idle;
				//this._enableFilter(true);
				this.checkSync();
			},
			
			select: function()
			{
				Mojo.Log.info("====STATE MACHINE PUSH.SELECT");
			},
			
			blur: function()
			{
				Mojo.Log.info("====STATE MACHINE PUSH.BLUR");
			},
			
			edit: function()
			{
				Mojo.Log.info("====STATE MACHINE PUSH.EDIT");
			},
			
			sync: function()
			{
				Mojo.Log.info("====STATE MACHINE PUSH.SYNC");
				this._needsync = true;
			},
			
			selectname: function()
			{
				Mojo.Log.info("====STATE MACHINE PUSH.SELECTNAME");
			},
			
			listloaded: function()
			{
				Mojo.Log.info("====STATE MACHINE PUSH.LISTLOADED");
			}
		},
		
		pop:
		{
			_name: 'pop',
			
			reset: function()
			{
				Mojo.Log.info("====STATE MACHINE POP.RESET");
				if (this.task) 
				{
					this.saveCurrentTask();
					this.setCurrentTask(null);
				}
			},
			
			blur: function()
			{
				Mojo.Log.info("====STATE MACHINE POP.BLUR");
			},
			
			sync: function()
			{
				Mojo.Log.info("====STATE MACHINE POP.SYNC");
			},
			
			listloaded: function()
			{
				Mojo.Log.info("====STATE MACHINE POP.LISTLOADED");
			}
		}
	},
	
	/**************************************************************/
	/* Task */
	
	currentTask: null,
	
	setCurrentTask: function(task)
	{
		Mojo.Log.info(">>>>>>>>>>>>>>>> SET CURRENT TASK " + JSON.stringify(task));
		
		if (this.task)
		{
			this.task.removeUpdateListener(this);
		}
		State.task = task;
		this.task = task;
		this.modifiedTask = {};
		if (task) 
		{
			var self = this;
			this.task.addUpdateListener(this, function(model, diff, scene)
			{
Mojo.Log.info(">>>>>>>>>>>>>>>> task addupdatelistener callback");
				//--Mojo.Log.info("****************** ON CURRENT TASK UPDATED ******");
				
				// If the 'duedate' or 'completed' has changed, we need to fixup the dueItemCount in the tasklist
				if ('dueDate' in diff || 'completed' in diff)
				{
					self.taskList.update(this, { dueItemCount: null });
				}
				
				// The remaining changes are only necessary if this scene didnt make them (otherwise we've done them already)
				if (scene != self) 
				{
Mojo.Log.info(">>>>>>>>>>>>>>>> task addupdatelistener - 1");					
					//--Mojo.Log.info("--model %j diff %j list", model, diff);
					// If we are marked deleted, or completed and we shouldnt be shown, remove from list
					if (model.deleted || (model.completed && self.modifiedTaskList.show == "remaining"))
					{
Mojo.Log.info(">>>>>>>>>>>>>>>> task addupdatelistener - 2");	
						//--Mojo.Log.info("-cancelAddedItem");
						self.listElement.mojo.noticeRemovedItems(self.getListIndexByItem(model), 1);
					}
					// If the task's tasklist has changed and we're not the all-tasks list, we must remove it from the list
					else if ('taskListId' in diff && !TaskList.isAllTasks(State.taskList)) 
					{
Mojo.Log.info(">>>>>>>>>>>>>>>> task addupdatelistener - 3");							
						//--Mojo.Log.info("-cancelAddedItem");
						self.listElement.mojo.noticeRemovedItems(self.getListIndexByItem(model), 1);
						// Force a list-of-list update
						State.listOfLists.update();
					}
					// If we change the duedate and we're ordering by due date, we must update the entire list (re-sort)
					else if (self.modifiedTaskList.order == "duedate" && "dueDate" in diff)
					{
Mojo.Log.info(">>>>>>>>>>>>>>>> task addupdatelistener - 4");	
						self.invalidateList();
					}
					// If we change the priority and we're ordering by priority, we must update the entire list (re-sort)
					else if (self.modifiedTaskList.order == "priority" && "priority" in diff)
					{
Mojo.Log.info(">>>>>>>>>>>>>>>> task addupdatelistener - 5");	
						self.invalidateList();
					}
					// Otherwise, just update us in the list
					else 
					{
Mojo.Log.info(">>>>>>>>>>>>>>>> task addupdatelistener - 6");	
						//--Mojo.Log.info("-updateItem");
						self.listElement.mojo.noticeUpdatedItems(self.getListIndexByItem(model), [ model ]);
					}
				}
			});
		}
	},
	
	/**
	 * Event fired when a task looses focus.
	 * ƒadd
	 * @param {Object} event
	 */
	onTaskBlur: function(event)
	{
		// Only fire if its the current task .. and defer it since we actually want this to come
		// after we've processed any other events relevant to what's being blurred.
		var self = this;
		(function()
		{
			var item = self.listElement.mojo.getItemByNode(event.target);
			if (item !== null && item == self.task) 
			{
				//--Mojo.Log.info("Blur %j %j", item, self.task);
				self.state.blur.call(self);
			}
		}).defer();
	},
    
	/**
	 * Event fired when we change the task.
	 * This event is not passed to the state machine.
	 * 
	 * @param {Object} event
	 */
    onTaskChanged: function(event)
	{
		//Mojo.Log.info(">>>>>>>>>>>>>>>>>>>>>ONTASKCHANGED " + JSON.stringify(event));
		if (event.property == 'deleted' && event.value === false)
		{
			// Aborted a delete
			//--Mojo.Log.info("Reset");
			this.state.reset.call(this);
		}
        else if (event.target.id)
		{
            // We get 2 events when entering high ascii characters
            // causing the event.target.id to have value of either the div or the text area
            // in the div. Not reliable but we know that it contains either checkbox- or subject-
            var item = this.listElement.mojo.getItemByNode(event.target);
            //--Mojo.Log.info("New value: %s (id: %s) - item %j", event.value, event.target.id, item);
            
            if (item) 
			{
                if (event.target.id.indexOf('completed-') != -1) 
				{
					//--Mojo.Log.info("setcompleted");
					this.state.setcompleted.call(this, event.value, event.target);
                }
                else if (event.target.id.indexOf('subject-') != -1) 
				{
					//--Mojo.Log.info("setsubject");
					this.state.setsubject.call(this, event.value);
                }
            }
        }
    },
	
	/**
	 * Event fired when we hit the a key.
	 * 
	 * @param {Object} event
	 */
	onKey: function(event)
	{
		if (event.keyCode === Mojo.Char.enter && event.target.id && event.target.id.indexOf('subject-') != -1)
		{
			//--Mojo.Log.info("Enter");
			this.state.enter.call(this);
		}
	},
	
	/**
	 * Event fired when we tap a list entry.
	 * 
	 * @param {Object} event
	 */
	handleTapCapture: function(event)
	{
		var item = this.listElement.mojo.getItemByNode(event.target);
		if (item)
		{
			Mojo.Log.info("Select ", JSON.stringify(item));
			this._stopScrolling();
			this.state.select.call(this, event.target, item);
		}
	},
	
	/**
	 * We cannot reorder a new item (one without an id).  If we detech this we stop
	 * the reorder from starting.
	 * 
	 * @param {Object} event
	 */
	handleHoldCapture: function(event)
	{
		 var item = this.listElement.mojo.getItemByNode(event.target);
		 if (item && !item.id)
		 {
			this._stopScrolling();
			Event.stop(event);
		 }
	},
    
    handleTap: function(event)
	{
		if (event.item)
		{
			//--Mojo.Log.info("Edit %j", event.item);
			this.state.edit.call(this, event.item);
		}
	},
	
	editCurrentTask: function()
	{
		// Save the task list if necessary (name may have changed)
		this.saveTaskList();
		
		Mojo.Log.info("Pushing scene task "+ JSON.stringify(this.modifiedTask));
		this.controller.stageController.pushScene('task', this.modifiedTask);
	},

	addItem: function(previousTask)
	{
		//--Mojo.Log.info("onAddTask");
	    // Save the list so that we have a valid taskList.id
		// The list will be empty, so no need to refresh it
		if (!this.modifiedTaskList.name)
		{
			this.modifiedTaskList.name = TaskList.getNameWithDefault(this.taskList);
		}
		var self = this;
		
		this.saveTaskList(function()
		{
			self.setCurrentTask(self._newTask(previousTask));
		});
	},
	
	_nextNewId: 1,

	/**
	 * Called when tapping on the + button
	 *
	 * handle nicely
	 * - when creating a new task
	 * - when creating a new task while one is already created (but not modified yet)
	 * - when creating a new task while one is already created and modified and to be saved (arg)
	 *
	 */
	_newTask: function(previousTask)
	{
		var aboveOrBelow = 'below';
	    //--Mojo.Log.info('_newTask %s %j', aboveOrBelow, previousTask);
		
		var task = new Task({ subject: '', completed: false });
		task._isnew = true;
	    
	    // Increment the newId so that we never get 2 items with the same id
		task._newId = this._nextNewId++;
		task.taskListId = this.taskList.id;
		if (db.isAllTasks(this.taskList._kind) || db.isUnfiled(this.taskList._kind)){ //override with null for alltasks, unfiled 
			task.taskListId = null; //db.getUnfiledTaskListId();
		}
    
		// Find the position first to scroll to it first
		var self = this;
		task.priority = 2; // Default priority
		task.taskListKind = this.taskList._kind;
		if (task.taskListKind === "com.palm.tasklist.alltasks:1"){
			task.taskListKind = "com.palm.tasklist.unfiled:1";
		}
		task.getPositionIndex(this, function(status, position)
		{
			var index = self.listElement.mojo.getLength();
			Mojo.Log.info('task position: %d %d', position, index);
			// 1000 is the default space between task to allow fast moving around
			task.position = position + 1000;
			self.listElement.mojo.insertItemsAt(index, [task]);
			self.listElement.mojo.revealItem(index);
			var node = self.listElement.mojo.getNodeByIndex(index);
			if (node) 
			{
				// If we find the node we just added, focus on it.  We might not find the node however if the list is being refreshed
				self.addWidgets(node.querySelector('[name="subject"]'), task);
				self.listElement.mojo.focusItem(task);
			}
			
			//--Mojo.Log.info("New task %j %j", task, self.task);
		});

		
		return task;
	},

	/**
	 * Saved any pending changes (e.g. a newly updated task)
	 */
	saveCurrentTask: function()
	{
		var task = this.task;
		if (task)
		{
			if (task.update(this, this.modifiedTask))
			{
				// Fixup the subject (if necessary)
				task.subject = Task.nameFromItem(task);
				
				// Make sure the task changes are refected in the list (incase it gets redrawn)
				var idx = this.getListIndexByItem(task);
				if (idx !== undefined && !(task.completed && this.modifiedTaskList.show == "remaining")) 
				{
					this.listElement.mojo.noticeUpdatedItems(idx, [task]);
				}
				
				//--Mojo.Log.info("Saving task %j %j", task, this.modifiedTask);
				task.save(this);
				// If we modified the 'completed' state, we must update the tasklist dueItemCount
				if ('completed' in this.modifiedTask) 
				{
					this.taskList.update(this, { dueItemCount: null });
				}
				// If we dont have a taskListId then this will go under 'unfiled' which may in turn make that list appear
				if (!task.getTaskListId()) 
				{
					State.listOfLists.update();
				}

//TASK: uncomment next block				
				
				// If we've modifed the task in the dashboard, we must force it to update
//				if (task.id !== undefined && task.id == State.dashboard.taskId)
//				{
//					State.dashboard.update(this, { taskName: task.subject });
//				}
				return true;
			}
		}
		return false;
	},
	
	addWidgets: function(node, model)
	{
		var common = Element.extend(node).up('.title');
		if (common) 
		{
			var subject = common.down('[name="subject"]');
			var completed = common.down('[name="completed"]');
			//--Mojo.Log.info("addWidgets", subject.id, completed.id);
			
			if (subject.getAttribute('x-mojo-element') != 'TextField') 
			{
				subject.setAttribute('x-mojo-element', 'TextField');
				model.titleFormatted = model.subject;
				this.controller.setWidgetModel(subject, model);
			}
			if (completed.getAttribute('x-mojo-element') != 'CheckBox') 
			{
				completed.setAttribute('x-mojo-element', 'CheckBox');
				this.controller.setWidgetModel(completed, model);
			}
			this.controller.newContent(common);
		}
	},
	
	_fadeTaskIfComplete: function(task, mtask)
	{
		if (this.modifiedTaskList.show === "remaining" && mtask.completed && mtask.completed === true) 
		{
			var target = this.listElement.mojo.getNodeByIndex(this.getListIndexByItem(task));
			this._fadeAndRemoveTask(target.down(".row-fader"), task);
		}
	},
	
	_fadeAndRemoveTask: function(fader, task)
	{
		var self = this;
		(function()
		{
			fader.style.display = "block";
			Mojo.Animation.animateStyle(fader, "opacity", "bezier", 
			{
				curve: "over-easy",
				from: 0,
				to: 1,
				duration: 0.3,
				styleSetter: function(value)
				{
					fader.style.opacity = value;
				},
				onComplete: function()
				{
					self.listElement.mojo.noticeRemovedItems(self.getListIndexByItem(task), 1);
				}
			});
		}).delay(0.2);
	},
	
	/**************************************************************/
	/* Sync */
	
	checkSync: function(force)
	{
		if (this._needsync || force)
		{
			this.invalidateList();
			this._needsync = false;
		}
	},
	
	_ignoreNextSync: function()
	{
		// Ignore the next sync, so long as it turn up within 10s
		this._ignoresync = (new Date()).getTime() + 10000;
	},
		
	/**************************************************************/
	/* TaskList */
	
	onTaskListName: function(event)
	{
		this.state.selectname.call(this);
	},
	
	onTaskListEnterKey: function(event)
	{
		if (event.keyCode != Mojo.Char.escape) 
		{	
			this._untouched = false; // When we type in a listname it becomes untouched
		}
		if (event.keyCode === Mojo.Char.enter)
		{
			Mojo.Log.info(">>>>Enter pressed from " + this.state._name + " state. " + this.state.add);
			this.state.add.call(this);
		}
	},
    
    saveTaskList: function(callback)
	{
		var taskList = this.taskList;
		if (!this._untouched && taskList && taskList.update(this, this.modifiedTaskList) && !TaskList.isAllTasks(taskList)) 
		{
			// Fixup the name (if necessary)
			taskList.name = TaskList.getNameWithDefault(taskList);
			//--Mojo.Log.info("** Saving task list");
			taskList.save(this, function()
			{
				if (callback){
					callback();
				}
			});
		}
		else 
		{
			if (callback){
				callback();
			}
		}
	},
    
    taskListNameChanged: function(event)
	{
        this.modifiedTaskList.name = event.value;
    },
	
	/**************************************************************/
    
    handleCommand: function(event)
	{
		//--Mojo.Log.info("handleCommand", event.type, event.command);
		if (event.type == Mojo.Event.back) 
		{
			this.state.back.call(this);
			Event.stop(event);
        }
        else if (event.type == Mojo.Event.command) 
		{
			if (event.command === 'add') 
			{
				this._stopScrolling();
				this.state.add.call(this);
			}
        }
    },
    
    handleFilter: function(event)
	{
        this.filterString = event.filterString;
		
        if (this.filterString) 
		{
			this.filterStringRegExp = new RegExp('(' + Weave.Utilities.RegExp.escape(this.filterString) + ')', 'i');
            this.sceneElement.addClassName('filtering');
			this.filterFieldElement.mojo.open();
            this.controller.select('.palm-filterfield-spacer')[0].addClassName('filtering');
        }
        else 
		{
			this.filterStringRegExp = null;
            this.sceneElement.removeClassName('filtering');
			this.controller.select('.palm-filterfield-spacer')[0].removeClassName('filtering');
        }
		
		// Make sure we're not editing/selected/etc...
		this.state.reset.call(this);
        
        this.invalidateList();
    },
	
	_enableFilter: function(enable)
	{
		this._filterState.disabled = !enable;
		this.controller.modelChanged(this._filterState);
	},
    
    handleDelete: function(event)
	{
		var item = event.item;
        if (item) 
		{
			if (item.id) 
			{
				var self = this;
				(new Task(item).remove(this, function()
				{
					self._ignoreNextSync(); // The update may generate a sync - which we ignore
				}));
			}

			if (this.task && (item.id == this.task.id)) 
			{
				this.setCurrentTask(null);
			}
			// If we've modifed the task in the dashboard, we must force it to update
//			if (item.id == State.dashboard.taskId)
//			{
//				State.dashboard.update(this, { taskId: item.id }, true);
//			}
//			// Deleting a task may effect the due count
//			this.taskList.update(this, { dueItemCount: null });
			// If list count goes to zero or we're the alltasks list, we may have to change how the list is displayed
			if (this.listElement.mojo.getLength() === 0 || TaskList.isAllTasks(this.taskList)) 
			{
				// Force a list-of-list update
				State.listOfLists.update();
			}
		}
		this.state.reset.call(this);
    },
    
    handleReorder: function(event)
	{
        var item = event.item;
        if (item && item.id) 
		{
            //--Mojo.Log.info('Moving from %s to %s', event.fromIndex, event.toIndex);
            var self = this;
			item.taskListKind = this.taskList._kind;
			(new Task(item).move(this, this.modifiedTaskList.show, this.filterString, event.toIndex, event.fromIndex, function()
			{
				self._ignoreNextSync(); // The update may generate a sync - which we ignore
			}));
        }
		this.state.reset.call(this);
    },
    
    itemsCallback: function(widget, offset, limit)
	{	
		var self = this;
		
		this.taskList.getTasks(this, this.modifiedTaskList.show, this.filterString, this.modifiedTaskList.order, offset, limit, function(status, list, count)
		{
			Mojo.Log.info("itemsCallback .. called back %d %d %d", offset, count, limit);
			
            self.formatItems(offset, list, count);
			
			// Handle filtering count
			if (self.filterString)
			{
				self.filterFieldElement.mojo.setCount(count);
				// If we're filtering a list, put the focus back at the top
				if (offset === 0) 
				{
					self.listElement.mojo.revealItem(0);
				}
			}
			// Tell the state machine we're done
			if (count <= offset + limit) 
			{
				self.state.listloaded.call(self);
			}
        });
    },
    
    // Weird actually we have a dummy propery that we don't use
    // Instead we simply update the existing item.
    formatItem: function(dummy, item)
	{
		var due = item.dueDate;
        if (due) 
		{
            item.infoClassFormatted = 'label due-date info';
//Mojo.Log.info("DATE BEFORE FORMATTING " + due);
			var currentDate = new Date();
			
            item.dueDateFormatted = Mojo.Format.formatDate((new Date(due + currentDate.getTimezoneOffset()*60*1000)), { 
				date: 'short'
			});
//Mojo.Log.info("DATE AFTER FORMATTING " +   item.dueDateFormatted);
        }
        else 
		{
            item.infoClassFormatted = 'icon tasks-icon info';
			item.dueDateFormatted = '';
        }
        
        item.classFormatted = Task.priorityName(item.priority);
        
        // Special trick for the newly created task
        if (item._newId) 
		{
            // No name yet
            item.titleFormatted = item.subject.split('\n')[0];
			item.idFormatted = 'new' + item._newId;
        }
        else 
		{
            item.titleFormatted = Task.nameFromItem(item).split('\n')[0];
			item.idFormatted = item.id;
        }
		
		item.titleFormatted = item.titleFormatted.escapeHTML();
		if (this.filterStringRegExp)
		{
            item.titleFormatted = item.titleFormatted.replace(this.filterStringRegExp, '<span class="list-highlight">$1</span>');
		}
		
		////--Mojo.Log.info("Item %j", item);
    },
       
    formatItems: function(offset, list, count)
	{
		this.listElement.mojo.updateItemsAndTotalLength(offset, list, count);
	},
	
	_itemsDividers: function(model)
	{
		//Mojo.Log.info ('====================ITEMS DIVIDERS model ');
		//--Mojo.Log.info("itemsDividers", this.modifiedTaskList.order);
		switch (this.modifiedTaskList.order)
		{
			case "priority":
				// Explicit localization
				switch (Task.priorityName(model.priority))
				{
					case "low":
						return $L("Low");
					case "high":
						return $L("High");
					case "normal":
						return $L("Normal");
					default:
						return $L("Normal");
				}
				break;
			case "duedate":
				return undefined;
			case "myorder":
				return undefined;
			default:
				return undefined;
        }
	},

	handleDeleteListCmd: function()
	{
		var taskList = this.taskList;
		var self = this;
		this.controller.showAlertDialog(
		{
	        onChoose: function(value) 
			{
				if (value == 'delete')
				{
				    if (taskList.id) 
					{
				        //--Mojo.Log.info("Delete: %s", taskList.id);
						taskList.remove(self);
						taskList.update(self, { id: undefined });
				    }
					self.modifiedTaskList = {}; // Prevent it from being saved by deleting any modifications
				    self._popScene();
				}
			},
	        title: $L("Delete list"),
	        message: $L("Are you sure you want to delete this list?"),
	        choices:
			[
	             {label:$L('Delete'), value:'delete', type:'negative'},
	             {label:$L("Cancel"), value:'cancel'}
	        ]
        });
		this.state.reset.call(this);
	},
	
	_popScene: function()
	{
		this.controller.stageController.popScene();
	},
	
	_onSceneDeactivate: function()
	{
		this.saveTaskList();
		this.state.reset.call(this);
	},
	
	_stopScrolling: function()
	{
		var scroller = Mojo.View.getScrollerForElement(this.controller.sceneElement);
		var pos = scroller.mojo.getScrollPosition();
		scroller.mojo.scrollTo(pos.left, pos.top, false, true);
	},

	invalidateList: function()
	{
Mojo.Log.info(">>>>>>>>>>>>>>>>>> INVALIDATE LIST");
		this._needsync = false;
		this.listElement.mojo.reloadAll();
	},

	handleMarkCompletedCmd: function()
	{
		if (this.state.setcompleted && typeof(this.state.setcompleted) === "function"){
			this.state.setcompleted.call(this, true); //saves freshly created entry before marking all complete	
		}
		var self = this;
		this.taskList.setAllComplete(this, true, function()
		{
			self._ignoreNextSync(); // The update may generate a sync - which we ignore
			// We dont know the due count now and cannot calculate it - so we'll have to refetch it form the DB
			self.taskList.update(self, { dueItemCount: null });
		});
		if (this.modifiedTaskList.show == 'all') 
		{
			this._forAllTasks.bind(this, 'completed', 'true').defer();
		}
		else
		{
			this.invalidateList();
		}
		//--Mojo.Log.info("Reset");
		this.state.reset.call(this);
	},

	handleMarkIncompleteCmd: function()
	{
		if (this.state.setcompleted && typeof(this.state.setcompleted) === "function"){
			this.state.setcompleted.call(this, true); //saves freshly created entry before marking all complete	
		}
		var self = this;
		this.taskList.setAllComplete(this, false, function()
		{
			self._ignoreNextSync(); // The update may generate a sync - which we ignore
			// We dont know he due count now and cannot calculate it - so we'll have to refetch it form the DB
			self.taskList.update(self, { dueItemCount: null });
		});
		if (this.modifiedTaskList.show == 'all') 
		{
			this._forAllTasks.bind(this, 'completed', false).defer();
		}
		else
		{
			this.invalidateList();
		}
		//--Mojo.Log.info("Reset");
		this.state.reset.call(this);
	},

	handleSetDueDateCmd: function()
	{
	    var self = this;
	    this.controller.showDialog({
	        template: 'datepicker/datepicker-scene',
	        assistant: new DatePickerAssistant({
				sceneAssistant: this,
		        title: $L('Set due date for all'),
		        callback: function(dueDate)
				{
					self.taskList.setAllDueDate(self, dueDate, function()
					{
						self._ignoreNextSync(); // The update may generate a sync - which we ignore
						// We dont know the due count now and cannot calculate it - so we'll have to refetch it from the DB
						self.taskList.update(this, { dueItemCount: null });
					});
					self._forAllTasks.bind(self, 'dueDate', dueDate).defer();
		        }
		    })
		});
		//--Mojo.Log.info("Reset");
		this.state.reset.call(this);
	},

	handlePurgeCompletedCmd: function()
	{
	    var self = this;
		this.controller.showAlertDialog(
		{
	        onChoose: function(value) 
			{
				if (value == "delete") 
				{
					var scrim = new Weave.Utilities.Scrim(this, "scrim", $L("Deleting completed tasks..."), true);
					self.taskList.purgeAllComplete(this, function()
					{
						scrim.stop();
						self.invalidateList();
						// If the unfile or alltasks lists, we must update the list-of-lists after a purge because it
						// might make the unfiled list disappear
						if (TaskList.isUnfiled(self.taskList) || TaskList.isAllTasks(self.taskList)) 
						{
							State.listOfLists.update();
						}
					});
				}
			},
	        title: $L("Delete Completed Tasks"),
	        message: $L("Are you sure you want to delete all completed tasks?"),
	        choices:
			[
	             {label:$L('Delete Completed'), value:'delete', type:'negative'},
	             {label:$L("Cancel"), value:'cancel'}
	        ]
        });
		//--Mojo.Log.info("Reset");
		this.state.reset.call(this);
	},
	
	handleHideShowCompletedCmd: function(event, item)
	{
		var nstate = this.modifiedTaskList.show == 'all' ? 'remaining' : 'all';
		this._setShow(nstate);
		if (nstate == "all")
		{
			item.label = $L("Hide Completed");
		}
		else
		{
			item.label = $L("Show Completed");
		}
		this.controller.modelChanged(this._appmenu.model);
	},
	
	_forAllTasks: function(propname, propvalue)
	{
		var models = this.listElement.mojo.getModels();
		for (var i = models.length - 1; i >= 0; i--)
		{
			models[i][propname] = propvalue;
		}
		this.listElement.mojo.rerenderAll();
	},

	_setShow: function(what)
	{
		if (this.modifiedTaskList.show != what) 
		{		
			this._untouched = false;
			this.modifiedTaskList.show = what;
			this.saveCurrentTask();
			this.invalidateList();
			this.listElement.mojo.revealItem(0);
		}
	},

	showOrderChanged: function(event)
	{
	    Mojo.Log.info('show order %s', event.value);
		
		if (!(event.untouched && event.untouched === true)) { //Check to see if called manually with untouched === true, or change by user
			this._untouched = false;
		}
		if (event.value == "position")
		{
			this.listAttr.reorderable = true;
		}
		else
		{
			this.listAttr.reorderable = false;
		}
		this.saveCurrentTask();
		this.invalidateList();
		// Remove old dividers
		var divs = this.listElement.querySelectorAll('table.palm-divider');
		var len = divs.length;
		for (var i = 0; i < len; i++)
		{
			divs[i].parentNode.removeChild(divs[i]);
		}
		this.state.reset.call(this);
	},
	
	_blurCurrent: function()
	{
		var focus = this.sceneElement.querySelector(':focus');
		if (focus)
		{
			focus.blur();
		}
		
		
	},
	
	// ----------------- List utilities ------------------
	
	/**
	 * Find the index of an item in the list.
	 * 
	 * @param {Object} item
	 */
	getListIndexByItem: function(item)
	{
		var idx = undefined;
		if (item) 
		{
			if (item._newId !== undefined)
			{
				idx = this.listElement.mojo.getItemIndexByProperty(item._newId, '_newId');
			}
			else if (item.id !== undefined) 
			{
				idx = this.listElement.mojo.getItemIndexByProperty(item.id, 'id');
			}
		}
		//if (idx === undefined) Mojo.Log.error("MISSING ID %j", item);
		return idx;
	},
	
	handleLoseFocus: function(event){
		this.state.reset.call(this);
	}
});
