/*jslint laxbreak: true, white: false, devel: true */
/*global Class: false, Mojo: false, $L: false, Template: false, Event: false, Form: false, Weave: false, Task: false, db: false, constants:false */


/* Copyright 2009 Palm, Inc.  All rights reserved. */

var TaskList = Class.create(Weave.Models.Model,
{
	load: function(scene, callback)
	{
		var self = this;
	    
		db.getTaskList(
		{
			id: this._getId()
		},
        function(response)
		{
			TaskList._fixup(response);
			self.merge(response);
			if (callback) {
				callback(true, self);
			}
		},
        function(response)
		{
			if (callback) {
				callback(false, response);
			}
	    });
		return this;
	},
	
	save: function(scene, callback)
	{
		var self = this;
		db.saveTaskList(
		{
			id: this._getId(),
			name: this.name,
			position: this.position,
			show: this.show,
			order: this.order,
			dueItemCount : this.dueItemCount ? this.dueItemCount : 0
		},
		function(response)
		{
			//Mojo.Log.info ("--------------------IN taskList save: " + JSON.stringify(response.id) + " " + scene)
			if (!self.id) 
			{
				self.update(scene, { id: response.id });
			}
			if (callback){
				callback(true);
			} 
		},
		function()
		{
			if(callback){
				callback(false);
			} 
		});
	},
	
	remove: function(scene, callback)
	{
		db.deleteTaskList(
		{
				id: this._getId()
		},
		function()
		{
			if (callback){
				callback(true);
			}
		},
		function()
		{
			if(callback){
				callback(false);
			} 
		});
	},
	
	setAllComplete: function(scene, completed, callback)
	{
		var method = completed ? 'markTasksCompleted' : 'markTasksIncomplete';
		db[method](
		{
				taskListId: this._getId()
		},
		function()
		{
			if (callback){
				callback(true);
			}
		},
		function()
		{
			if (callback){
				callback(false);
			}
		});
	},
	
	purgeAllComplete: function(scene, callback)
	{
		db.purgeCompletedTasks(
		{
			taskListId: this._getId()
		},
		function()
		{
			if (callback){
				callback(true);
			}
		},
		function()
		{
			if (callback){
				callback(false);
			}
		});
	},
	
	setAllDueDate: function(scene, dueDate, callback)
	{
		db.setTasksDueDate(
		{
				taskListId: this._getId(),
				dueDate: dueDate ? dueDate.getTime() : null
		},
		function()
		{
			if (callback){
				callback(true);
			}
		},
		function()
		{
			if (callback){
				callback(false);
			}
		});
	},
	
	getTasks: function(scene, what, filter, order, offset, limit, callback)
	{
		Mojo.Log.info('getTasks %s %s %s', this.id, offset, limit);
		
		if (this.id === undefined)
		{
			callback(true, [], 0);
			return;
		}
		
		var self = this;
		var getTasksParams = {
			_new: true, // Use new optimize query with no notification
			offset: offset,
			limit: limit,
			filter: filter,
			taskListId: this._getId(),
			what: what,
			order: order
		};
		
		if (getTasksParams.taskListId === db.getUnfiledTaskListId()){
			getTasksParams.unfiledFlag = true;
		}
		
		db.getTasks(
		getTasksParams,
		function(response)
		{
			var list = response.list;
			var len = list.length;
			for (var i = 0; i < len; i++)
			{
				list[i] = Task._fixup(list[i]);
			}
			
			if (callback) {
				callback(true, list, response.count);
			}
		},
		function(response)
		{
			if (callback){
				callback(false, response);
			}
		});
	},

	addExternalUpdateListener: function($super, scene, observer){
		//Mojo.Log.info("||||||||||||||||||||||||||||||| in addExternalUpdateListener");
		// If task list is saved (has an id), we observer it for any behind-the-back changes		
		
		//--Mojo.Log.info("Setting sync on tasklist %d", this.id)
		if (this.id) 
		{
			if (!this._syncrequest) 
			{
				var self = this;
				this._syncrequest = new Weave.Services.ServiceObserver(scene, "palm://com.palm.tasks/getTasks", 
				{
					taskListId: this._getId(),
					what: 'show_all',
					offset: 0,
					limit: 0,
					_new: true
				}, function(status)
				{
					//--Mojo.Log.info("Tasklist sync callback");
					self.externalUpdate(scene);
				}, { active: 5 });
			}
			$super(scene, observer);
		}
	},
	
	removeExternalUpdateListener: function($super, observer)
	{
		if (this._syncrequest) 
		{
			//--Mojo.Log.info("RemoveExternalUpdateListener");
			this._syncrequest.stop();
			this._syncrequest = null;
			$super(observer);
		}
	},
	
	_getId: function()
	{
		var isAllTasks = false;
		isAllTasks = TaskList.isAllTasks(this);
		var returnValue = isAllTasks ? undefined : (this.id ? this.id : this._id);
		Mojo.Log.info("taskList._getId() returning " + returnValue);
		return returnValue;
	}
});

Object.extend(TaskList,
{
	_serviceId: Task._serviceId,
	
	getAll: function(scene, filter, offset, limit, unfiled, callback)
	{
		db.getTaskLists(
		{
			_new: true,
			offset: offset,
			limit: limit,
			filter: filter,
			unfiled: unfiled
		},
        function(response)
		{
			var list = response.list;
			for (var i = 0; i < list.length; i++){
				(TaskList._fixup(list[i]));
			}
			if(callback){
				callback(true, response.list, response.count);	
			}
		},
		function(response)
		{
			if (callback) {
				callback(false, response);
			}
		});
	},
	
	isNew: function(item)
	{
	   // Mojo.Log.info("ITEM");
	    var isNew = !(item.id);
		Mojo.Log.info ("ITEM: " +JSON.stringify(item) + " is new?: " + isNew);
		return isNew;
	},
	

	
	isEAS: function(item)
	{
		if ( !(item && item.accountId) ){
			return false;
		}else{
			return db.isEasAccount(item.accountId);
		}
	},
	
	isDeleteable: function (item){
		//Mojo.Log.info("|||||||||||ISDEL " + JSON.stringify(item));
		if (item && item._kind && ( ! (db.isRegularLocalTaskList(item)) )){  
			return false;
		}else{
			return true;
		}
	},
	
	isAllTasks: function(item)
	{
		return !!(item && db.isAllTasks(item._kind));
	},
	
	isUnfiled: function(item) //is unfiled task list??
	{
	   return !!(item._kind && db.isUnfiled(item._kind));	
	},
	
	getNameWithDefault: function(taskList)
	{
		var taskListName;
	    if (taskList) 
		{
			taskListName = taskList.name;
			if (!taskListName) 
			{
				if (taskList.id) 
				{
					if (TaskList.isEAS(taskList))
					{
						taskListName = $L('EAS');
					}
					else if (TaskList.isUnfiled(taskList)) 
					{
						taskListName = $L('Unfiled');
					}
					else
					{
						taskListName = $L('List name');
					}
				}
				else
				{
					taskListName = $L('List name');
				}
			}
	    }
	    else 
		{
	        taskListName = $L('List all tasks');
	    }
	    return taskListName;
	},
	
	_fixup: function(list)
	{
		Mojo.Log.info("TASKLIST FIXUP ---- " + JSON.stringify(list));
		var disp = list.show ? list.show.split(":") : [];
		list.show = disp[0] ? disp[0] : "all";
		list.order = disp[1] ? disp[1] : "position";
		if (list.name === "Tasks" && list._kind && list._kind === constants.TASKLISTKINDEAS){
			list.name = "Exchange";
		}
	}
});