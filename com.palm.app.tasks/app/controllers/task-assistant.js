/*jslint laxbreak: true, white: false, devel: true */
/*global Class: false, Mojo: false, $L: false, Template: false, Event: false, Form: false, Task: false, TaskList: false, Weave: false, State: false, DatePickerAssistant: false, db:false */

/* Copyright 2009 Palm, Inc.  All rights reserved. */

var TaskAssistant = Class.create(
{
    initialize: function(pendingMods)
	{
		Mojo.Log.info("=== pendingMods " + JSON.stringify(pendingMods));
		this._pendingMods = pendingMods;
    },
	
    setup: function()
	{
        var model = State.task;
		this.task = model;
		 
        // Subject
        this.subjectAttributes = 
		{
            hintText: $L('Task name...'),
            focus: !model.id,
			multiline: true,
            textFieldMode: 'sentence-case',
			changeOnKeyPress: true,
			enterSubmits: true
        };
        this.subjectModel = 
		{
            value: this._pendingMods && this._pendingMods.subject ? this._pendingMods.subject : model.subject
        };
        
        // Completed
        this.completedAttributes = {};
        this.completedModel = 
		{
            value: model.completed
        };
        
        // Check box color
        this.checkBoxElement = this.controller.get('completed');
        if (model.priority) 
		{
            this.checkBoxElement.addClassName(Task.priorityName(model.priority));
        }
        
        // Priority
        this.priorities = [{
            label: $L('High'),
            value: 1,
            icon: 'checkbox-high'
        }, {
            label: $L('Normal'),
            value: 2,
            icon: 'checkbox-normal'
        }, {
            label: $L('Low'),
            value: 3,
            icon: 'checkbox-low'
        }];
        
        this.priorityAttributes = 
		{
            label: $L('Priority'),
            choices: this.priorities
        };
        this.priorityModel = 
		{
            value: model.priority ? model.priority : 2
        };
        
        // Task List name
        // For now only the current list
        // We update the content after we load
		// We also change the All Tasks name to Unfiled
		var taskListname = TaskList.getNameWithDefault(State.taskList);
		if (State.taskList._kind === "com.palm.tasklist.alltasks:1" || State.taskList._kind === "com.palm.tasklist.unfiled:1"){ //override with unfiled if all tasks
			taskListname = $L("Unfiled");
			model.taskListId = null;//db.getUnfiledTaskListId();
			model._kind = "com.palm.tasklist.unfiled:1";
		}

        this.taskListAttributes = {
			label: $L('List'),
            choices: [
				{
					value: 1,
					label: taskListname
				}
			]
        };
        this.taskListModel = {
            value: 1
        };
        
        // Notes
        this.notesAttributes = {
            focusMode: Mojo.Widget.focusAppendMode,
			hintText: model.id ? '' : $L('Notes...'),
            multiline: true,
            textFieldMode: 'sentence-case',
			changeOnKeyPress: true,
			runTextLinker: true,
			focus: !!model.id
        };
        this.notesModel = {};
        this.controller.setupWidget('completed', this.completedAttributes, this.completedModel);
        this.controller.setupWidget('subject', this.subjectAttributes, this.subjectModel);
        this.controller.setupWidget('completed', this.completedAttributes, this.completedModel);
        this.controller.setupWidget('priority', this.priorityAttributes, this.priorityModel);
        this.controller.setupWidget('taskList', this.taskListAttributes, this.taskListModel);
        this.controller.setupWidget('notes', this.notesAttributes, this.notesModel);
		
        var dueDateText = this.getInitialDueDateText(model);
        
        this.dueDateElement = this.controller.get('task_duedate');
        var button = Mojo.View.render({
            object: {
                text: dueDateText,
                buttonId: 'duedateButton'
            },
            template: "task/popupbutton"
        });
        this.dueDateElement.insert(button);
        this.controller.get('task_duebox').observe(Mojo.Event.tap, this.onDueDateTap.bindAsEventListener(this));
		this.saveTask = this.saveTask.bind(this);
		
		(new Weave.Utilities.AppMenu(this).addEdit().addItem($L('Delete Task'), this.handleDeleteCmd.bind(this)).addHelp());
		
		this._onSceneDeactivate = this._onSceneDeactivate.bindAsEventListener(this);
        
        this.subjectElement = this.controller.get('subject');
        this.notesElement = this.controller.get('notes');
        this.subjectElement.observe(Mojo.Event.propertyChange, this.subjectChanged.bind(this));
        this.controller.listen('completed', Mojo.Event.propertyChange, this.completedChanged.bind(this));
        this.controller.listen('priority', Mojo.Event.propertyChange, this.priorityChanged.bind(this));
        this.notesElement.observe(Mojo.Event.propertyChange, this.notesChanged.bind(this));
        this.controller.listen('taskList', Mojo.Event.propertyChange, this.taskListChanged.bind(this));
        
        // Lazily load the object
        // For the other information
		Mojo.Log.info("Should I get task?");
        if (model.id) 
		{
			Mojo.Log.info("** YES");
            // Don't allow saving until we get the information
            // will allow saving once the task is loaded
			
			this.controller.setInitialFocusedElement(this.notesElement);
			model.load(this, this.onTaskLoaded.bind(this));
        }
        else 
		{
			Mojo.Log.info("** NO %j", this._pendingMods);
			this.controller.setInitialFocusedElement(this.subjectElement);
			var newmodel = new Task(model);
			this._newmodel = newmodel;
			
			if (!model.priority) 
			{
                newmodel.priority = 2;
				model.priority = newmodel.priority;
            }
            // Initialize task list id
			newmodel.taskListId = (State.taskList ? State.taskList.id : undefined);
			if (db.isAllTasks(State.taskList._kind)){
				newmodel.taskListId = null;//db.getUnfiledTaskListId();
			}
			
			model.taskListId = newmodel.taskListId;
			
			// If we have a pending subject change, copy it into the new model
			// so it will be saved.
			if (this._pendingMods && this._pendingMods.subject)
			{
				newmodel.subject = this._pendingMods.subject;
			}
            
            // Get the task lists!
            this._loadTaskLists();
        }
    },
    
    cleanup: function()
	{
        this.controller.get('task_duebox').stopObserving(Mojo.Event.tap, this.onDueDateTap.bindAsEventListener(this));
		this.subjectElement.stopObserving(Mojo.Event.propertyChange, this.subjectChanged.bind(this));
		this.notesElement.stopObserving(Mojo.Event.propertyChange, this.notesChanged.bind(this));
		
		this.controller.stopListening('completed', Mojo.Event.propertyChange, this.completedChanged.bind(this));
        this.controller.stopListening('priority', Mojo.Event.propertyChange, this.priorityChanged.bind(this));
        this.controller.stopListening('taskList', Mojo.Event.propertyChange, this.taskListChanged.bind(this));
		
		
		Mojo.Log.info('TaskAssistant::cleanup');
//      if (!this.saveTask())
//		{
//			// Didnt save the task - if this was new then we mark is as deleted
//			if (!this.task.id)
//			{
//				this.task.update(this, { deleted: true });
//			}
//		}
    },
	
    /**
     * Also initialize the choice for the list
     * @param {Object} task
     */
    getInitialDueDateText: function(task){
        var dueDateText;
        if (task.dueDateText === '') {
            return task.dueDateText;
        }
        
        if (task.dueDate) {
            this.dueDateChoice = 'custom';
			var currentDate = new Date();
            var date = new Date(task.dueDate + currentDate.getTimezoneOffset()*60*1000);
            dueDateText = Mojo.Format.formatDate(date, { date: 'default' });
        }
        else {
            this.dueDateChoice = 'none';
            dueDateText = $L('No due date');
        }
        return dueDateText;
    },
    
    onDueDateTap: function(e)
	{
        Mojo.Log.info('onDueDateTap');
        
        var date = new Date();
		//var format = $L("MM/dd");
		//function oDate(offset)
		//{
		//	var d = new Date();
		//	d.setTime(date.getTime() + offset);
		//	return d;
		//}
        var dueDateChoices = [{
            label: $L('No due date'),
            command: 'none'
        }, {
			label: $L('Today'),
            //label: $L('Today #{date}').interpolate({ date: Mojo.Format.formatDate(date, format) }),
            command: 'today'
        }, {
			label: $L('Tomorrow'),
            //label: $L('Tomorrow #{date}').interpolate({ date: Mojo.Format.formatDate(oDate(86400000), format) }),
            command: 'tomorrow'
        }, {
			label: $L('In one week'),
            //label: $L('In one week #{date}').interpolate({ date: Mojo.Format.formatDate(oDate(604800000), format) }),
            command: 'one_week'
        }, {
			label: $L('In one month'),
            //label: $L('In one month #{date}').interpolate({ date: Mojo.Format.formatDate(oDate(2592000000), format) }),
            command: 'one_month'
        }, {
            label: $L('Other...'),
            command: 'other'
        }];
        
        if (this.dueDateChoice == 'custom') 
		{
            var currentDate = new Date();
			dueDateChoices.unshift({
                label: Mojo.Format.formatDate(new Date(this.getCurrentDueDateMs() + currentDate.getTimezoneOffset()*60*1000), { date: 'default' }),
                command: 'custom'
            });
        }
        this.controller.popupSubmenu({
            onChoose: this.onDueDateSelected.bind(this),
            placeNear: e.target,
            toggleCmd: this.dueDateChoice,
            items: dueDateChoices
        });
    },
    
    getCurrentDueDateMs: function()
	{
        return this._newmodel.dueDate ? this._newmodel.dueDate : undefined;
    },
    
    onDueDateSelected: function(value)
	{
        //log('onDueDateSelected: ' + value);
        if (value !== undefined && value != this.dueDateChoice || value == 'other') 
		{
            var dueDateText;
            var newDueDateMs;

            switch (value) 
			{
                case 'none':
                    dueDateText = $L('No due date');
                    newDueDateMs = null;
                    break;
                case 'today':
                    dueDateText = $L('Today');
                    newDueDateMs = Date.today().setTimezoneOffset(0).getTime();
                    Mojo.Log.info ("------------DATE -------------" + newDueDateMs);
                    break;
                case 'tomorrow':
                    dueDateText = $L('Tomorrow');
                    newDueDateMs = Date.today().setTimezoneOffset(0).add(1).day().getTime();
                    Mojo.Log.info ("------------DATE -------------" + newDueDateMs);
                    break;
                case 'one_week':
                    newDueDateMs = Date.today().setTimezoneOffset(0).add(7).days().getTime();
                    Mojo.Log.info ("------------DATE -------------" + newDueDateMs);
                    break;
                case 'two_weeks':
                    newDueDateMs = Date.today().setTimezoneOffset(0).add(14).days().getTime();
                    Mojo.Log.info ("------------DATE -------------" + newDueDateMs);
                    break;
                case 'one_month':
                    newDueDateMs = Date.today().setTimezoneOffset(0).add(1).month().getTime();
                    Mojo.Log.info ("------------DATE -------------" + newDueDateMs);
                    break;
                case 'other':
                    this.onDueDateOtherTap();
                    return;            
			}
            
            if (newDueDateMs === undefined) 
			{
                return;
            }
            this.dueDateChoice = value;
            this._newmodel.dueDate = newDueDateMs;
			            
            if (!dueDateText) 
			{
                var currentDate = new Date();
				dueDateText = Mojo.Format.formatDate(new Date(newDueDateMs + currentDate.getTimezoneOffset()*60*1000), { date: 'default' });
            }
            
            this.updateButton(dueDateText);
        }
    },
    
    onTaskLoaded: function(status)
	{
		Mojo.Log.info("task loaded: %j", this.task);
		
		// Set a default priority if necessary
		if (!this.task.priority)
		{
			this.task.priority = 2;
		}
        
		// Create a new model using the old one as a template, but overwrite with newly loaded data
		// to fill in the gaps
		var newmodel = new Task(this.task);
        this._newmodel = newmodel;
		
        this.priorityModel.value = newmodel.priority;
        this.controller.modelChanged(this.priorityModel);
        this.updateCheckBoxColor(newmodel.priority);
        
		this.notesAttributes.hintText = $L('Notes...');
		this.notesModel.value = newmodel.notes;
        this.controller.modelChanged(this.notesModel);
        
        // Update completed if needed
        // This can happen when going from the dashboard
        if (newmodel.completed != this.completedModel.value) 
		{
            this.completedModel.value = newmodel.completed;
            this.controller.modelChanged(this.completedModel);
        }
         
        // Subject - needed when launched from task details
        this.subjectModel.value = newmodel.subject;
		
		// If we have a pending subject change from the previous screen, copy it into the new model
		// so it will be saved.
		if (this._pendingMods && this._pendingMods.subject)
		{
			 this.subjectModel.value = this._pendingMods.subject;
		}
		
        this.controller.modelChanged(this.subjectModel);
        
        // due date!
        this.updateButton(this.getInitialDueDateText(newmodel));
        
        // Get the task lists!
        this._loadTaskLists();
        
        // Set the focus on notes unless subject is empty
        if (newmodel.subject) 
		{
           this.notesElement.mojo.focus();
        }
        else 
		{
           this.subjectElement.mojo.focus();
        }

    },
    
    /**
     * Called once the task is loaded or when the priority is changed
     *
     * @param {Object} priority
     */
    updateCheckBoxColor: function(priority, priorityName)
	{
        this.checkBoxElement.removeClassName('high');
        this.checkBoxElement.removeClassName('low');
        this.checkBoxElement.removeClassName('normal');
        this.checkBoxElement.addClassName(priorityName ? priorityName : Task.priorityName(priority));
    },
	
	_loadTaskLists: function()
	{
		var self = this;
		TaskList.getAll(this, undefined, undefined, undefined, false, function(status, list)
		{
			self.taskListModel.value = ((self._newmodel.taskListId === db.getUnfiledTaskListId()) || !(self._newmodel.taskListId) ) ?  1 : self._newmodel.taskListId; //change to 1 if unfiled, since widget barfs with value=null
	        var taskLists = [];
	        for (var i = 0; i < list.length; i++) 
			{
	            var item = list[i];
	            
				if (TaskList.isUnfiled(item)){
					taskLists.push({
						value: 1,
						label: $L(TaskList.getNameWithDefault(item))
					});
				}
				else if (!(TaskList.isAllTasks(item))) {
					taskLists.push({
						value: item.id,
						label: $L(TaskList.getNameWithDefault(item))
					});
				}
	        }
			
			self.taskListAttributes.choices = taskLists;
			self.controller.modelChanged(self.taskListModel);
			
			if (self.taskListModel.value === 1){ //set taskListModel.value back to null
				self.taskListModel.value = null;
			} 
			
		});
    },
    
    saveTask: function(callback)
	{
		var model = this.task;
		// If the task has changed (but not deleted), then we need to save it
		if ( !model.deleted && ( model.update(this, this._newmodel) || 
		(State.task.forceSave && State.task.forceSave === true) ) ){
			if (State.task.forceSave){
				delete State.task.forceSave;
			}
			
			if (!model.subject && !this._newmodel.subject)
			{
				model.update(this, { subject: Task.nameFromItem(model) });
			}

			Mojo.Log.info("Saving task %j", model);
			model.save(this, callback);
			return true;
        }else if (callback && typeof(callback)==="function"){
			callback();
		}
		return false;
    },
    
    handleDeleteCmd: function()
	{
		var self = this;
		this.controller.showAlertDialog(
		{
	        onChoose: function(value) 
			{
				if (value == 'delete')
				{
				    if (self._newmodel.id) 
					{
			            self._newmodel.remove(self, function()
						{
							self.task.update(self, { deleted: true }); // Throw model away since we're deleting it
			                self.controller.stageController.popScene();
			            });
			        }
			        else 
					{
						self.task.update(self, { deleted: true }); // Throw model away since we're deleting it
			            self.controller.stageController.popScene();
			        }
				}
			},
	        //title: $L("Delete task"),
	        message: $L("Are you sure you want to delete this task?"),
	        choices:
			[
	             {label:$L('Delete'), value:'delete', type:'negative'},
	             {label:$L("Cancel"), value:'cancel', type:'dismiss'}
	        ]
        });
    },
    

    handleCommand: function(event)
	{
		if (event.type == Mojo.Event.back)
		{
			Event.stop(event);
			// Save the task
			this.saveTask(function(){
					this.controller.stageController.popScene();
				}.bind(this)
			);
		}
        else if (event.type == Mojo.Event.command) 
		{
            if (event.command && event.command === "delete"){
				this.handleDeleteCmd();
                Event.stop(event);
			}
        }
    },

	_onSceneDeactivate: function()
	{
		this.cleanup();
	},
    
    subjectChanged: function(event)
	{
        this._newmodel.subject = event.value;
    },
    
    completedChanged: function(event)
	{
        this._newmodel.completed = event.value;
    },
    
    priorityChanged: function(event)
	{
        this._newmodel.priority = event.value - 0; // Make sure it is a number
        this.updateCheckBoxColor(this._newmodel.priority);
    },
    
    taskListChanged: function(event)
	{
		this._newmodel.taskListId = (event.value === 1) ? null : event.value;
    },
    
    notesChanged: function(event)
	{
        this._newmodel.notes = event.value;
    },
    
    updateButton: function(dueDateText)
	{
        var button = Mojo.View.render({
			object: 
			{
				text: dueDateText,
				buttonId: 'duedateButton'
			},
			template: "task/popupbutton"
		});
        this.dueDateElement.update(button);
    },
    
    onDueDateOtherTap: function(event)
	{
        var self = this;
        var dateMs = this.getCurrentDueDateMs();
        var dueDateText;
		
        self.controller.showDialog({
			template: 'datepicker/datepicker-scene',
			assistant: new DatePickerAssistant(
			{
				title: $L('Set due date'),
				sceneAssistant: this,
				defaultDate: dateMs ? new Date(dateMs) : undefined,
				callback: function(date)
				{
					// Here either a date (or null for no due date) is selected
					// and must be saved to the current record
					self.updated = true;
					if (date) 
					{
						self.dueDateChoice = 'custom';
						self._newmodel.dueDate = date.getTime() - date.getTimezoneOffset()*60*1000; //compensate for the local timezone. timestamp created in GMT
						dueDateText = Mojo.Format.formatDate(date, { date: 'default' });
					}
					else 
					{
						self.dueDateChoice = 'none';
						self._newmodel.dueDate = null;
						dueDateText = $L('No due date');
					}
					self.updateButton(dueDateText);
				}
			})
		});
    },
   
    activate: function()
	{
		this.controller.document.addEventListener(Mojo.Event.stageDeactivate, this.saveTask);
	},
	
	deactivate: function()
	{
		this.controller.document.removeEventListener(Mojo.Event.stageDeactivate, this.saveTask);	
	}
});
