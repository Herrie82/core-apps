/*jslint laxbreak: true, white: false, devel: true */
/*global Class: false, Mojo: false, $L: false, Template: false, Event: false, Form: false, Weave: false, db: false */

/* Copyright 2009 Palm, Inc.  All rights reserved. */

var Task = Class.create(Weave.Models.Model,
{
	load: function(scene, callback)
	{
		var self = this;
	    db.getTask( 
			{
				id: this.id,
				fields: ['taskList']
			},
	        function(response)
			{
				self.merge(response);
				if (callback){
					callback(true, (Task._fixup(response)));
				} 
			},
	        function(response)
			{
				if(callback){
					callback(false, response);	
				}
		    }
		);
		return this;
	},
	
	save: function(scene, callback)
	{
		var self = this;
		//--Mojo.Log.info("Save task %j", this);
		db.saveTask( 
			{
				id: this.id,
				subject: this.subject,
				completed: this.completed,
				taskListId: this.getTaskListId(),
				dueDate: this.dueDate,
				priority: this.priority,
				notes: this.notes,
				alarm: this.alarm,
				reminder: this.reminder,
				position: this.position
			},
			function(response){
				if (!self.id) 
				{
					self.update(self, { id: response.id });
				}
				if(callback){
					callback(true, response);	
				}
			},
			function(response)
			{
				if(callback){
					callback(false, response);	
				}
		});
	},
	
	remove: function(scene, callback)
	{
		db.deleteTask(
		{
			id: this.id
		},
        function()
		{
			if(callback){
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
	
	getPositionIndex: function(scene, callback)
	{
	    db.getTaskPositionIndex({
			priority: this.priority,
			taskListId: this.getTaskListId()
		},
        function(response)
		{
			if(callback) {
				callback(true, response.nextPosition, response.index);	
			}
		},
        function(response)
		{
			if (callback) {
				callback(false, response);
			}
	    });
	},
	
	move: function(scene, what, filter, to, from, callback)
	{
		db.moveTask(
		{
			id: this.id,
			taskListId: this.getTaskListId(),
			filter: filter,
			what: what,
			fromIndex: from,
			toIndex: to
		},
		function()
		{
			if(callback){
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
	
	getTaskListId: function()
	{
		var returnValue = this.taskListId;
		if (!(this.id) && this.taskListKind && db.isAllTasks(this.taskListKind)){ //new and in 'all tasks'
					Mojo.Log.info("TaskList is All tasks, setting taskListId to unfiled tasklist's _id");
			returnValue = null;//db.getUnfiledTaskListId();
		}
		
		return returnValue;
	}
});

Object.extend(Task,
{
	_serviceId: "palm://com.palm.tasks",
	
	nameFromItem: function(item)
	{
	    return item.subject || $L('Task name...');
	},
	
	priorityName: function(priority)
	{
	    switch (priority) 
		{
	        case 1:
	            return 'high';
	        case 3:
	            return 'low';
	        default:
	            return 'normal';
	    }
	},
	
	// Fixup a task because everything is a string
	_fixup: function(task)
	{
		task.completed = parseInt(task.completed, 10) ? true : false;
		task.dueDate = task.dueDate ? parseInt(task.dueDate, 10) : null;
		task.priority = parseInt(task.priority, 10);
		task.position = task.position ? parseInt(task.position, 10) : null;
		return task;
	}
});


