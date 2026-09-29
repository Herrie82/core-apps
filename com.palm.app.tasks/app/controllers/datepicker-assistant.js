/*jslint laxbreak: true, white: false, devel: true */
/*global Class: false, Mojo: false, $L: false, Template: false, Event: false, Form: false, today: false*/

/**
 * @author alex
 
Copyright 2009 Palm, Inc.  All rights reserved.

*/
var DatePickerAssistant = Class.create({

    initialize: function(params){
        this.params = params;
        this.sceneAssistant = params.sceneAssistant;
        this.newDate = params.defaultDate ? params.defaultDate : new Date();
		if (params.defaultDate)
		{
			this.newDate = params.defaultDate;
		}
		else
		{
			var today = new Date();
			today.setMilliseconds(0);
			today.setSeconds(0);
			today.setMinutes(0);
			today.setHours(0);
	        this.newDate = today;
		}
        this.callback = params.callback;
        this.controller = params.sceneAssistant.controller;
    },
    
    setup: function(widget){
        Mojo.Log.info('DatePickerAssistant::setup');
        
        this.widget = widget;
        
		var currentDate = new Date();
		
        this.datePickerModel = {
            date: new Date(this.newDate.getTime() + currentDate.getTimezoneOffset()*60*1000)
        };
        this.controller.setupWidget('datepicker', undefined, this.datePickerModel);

        if (this.params.title) {
            this.controller.get('title').update(this.params.title);
        }
        
        // Handlers
        this.dateChangedHandler = this.onDateChanged.bindAsEventListener(this);
        this.selectHandler = this.onSelect.bindAsEventListener(this);
        this.cancelHandler = this.onCancel.bindAsEventListener(this);
        this.noneHandler = this.onNone.bindAsEventListener(this);
    },
    
    activate: function(){
        this.controller.get('datepicker').observe(Mojo.Event.propertyChange, this.dateChangedHandler);
        this.controller.get('select').addEventListener(Mojo.Event.tap, this.selectHandler);
        this.controller.get('cancel').addEventListener(Mojo.Event.tap, this.cancelHandler);
        this.controller.get('none').addEventListener(Mojo.Event.tap, this.noneHandler);
    },
    
    deactivate: function(){
        this.controller.get('datepicker').stopObserving(Mojo.Event.propertyChange, this.dateChangeHandler);
        this.controller.get('select').removeEventListener(Mojo.Event.tap, this.selectHandler);
        this.controller.get('cancel').removeEventListener(Mojo.Event.tap, this.cancelHandler);
        this.controller.get('none').removeEventListener(Mojo.Event.tap, this.noneHandler);
    },
    
    onNone: function(event){
        this.widget.mojo.close();
        this.callBack(null);
    },
    
    onSelect: function(event){
        this.widget.mojo.close();
        this.callBack(this.newDate);
    },
    
    onCancel: function(event){
        this.widget.mojo.close();
    },
    
    onDateChanged: function(event){
        Mojo.Log.info("Selected: " + event.value);
        this.newDate = event.value;
    }
});

DatePickerAssistant.prototype.callBack = function(date){
    if (this.params.callback) {
        this.params.callback(date);
    }
};

