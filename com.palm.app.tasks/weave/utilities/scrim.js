/*jslint laxbreak: true, white: false, devel: true */
/*global Class: false, Mojo: false, $L: false, Weave: false, Event: false, Form: false */

/* Copyright 2009 Palm, Inc.  All rights reserved. */

Weave.Utilities.Scrim = Class.create(
{
	_delay: 2000,
	_hold: 1000,
	
	initialize: function(sceneAssistant, id, message, start)
	{
		this._message = message;
		this._scrim = sceneAssistant.controller.get(id);
		this._state = 'stopped';
		if (start)
		{
			this.start();
		}
	},
	
	start: function()
	{
		this._fire('start');
	},
	
	stop: function()
	{
		this._fire('stop');
	},
	
	_fire: function(event)
	{
		Mojo.Log.info('Scrim event', event, 'state', this._state);
		var self = this;
		switch (this._state)
		{
			case 'stopped':
				switch (event)
				{
					case 'start':
						this._state = 'starting';
						this._timer = setTimeout(function() { self._fire('starting2sec'); }, this._delay);
						break;
						
					case 'stop':
					case 'starting1sec':
					case 'running1sec':
						break;
				}
				break;
				
			case 'starting':
				switch (event)
				{
					case 'starting2sec':
						this._state = 'runningquick';
						this._show();
						this._timer = setTimeout(function() { self._fire('running1sec'); }, this._hold);
						break;
						
					case 'stop':
						clearTimeout(this._timer);
						this._state = 'stopped';
						break;
						
					case 'start':
					case 'running1sec':
						break;
				}
				break;
				
			case 'runningquick':
				switch (event)
				{
					case 'running1sec':
						this._state = 'running';
						break;
						
					case 'stop':
						this._state = 'stopping';
						break;
						
					case 'start':
					case 'starting2sec':
						break;
				}
				break;
				
			case 'running':
				switch (event)
				{
					case 'stop':
						this._state = 'stopped';
						this._hide();
						break;
						
					case 'start':
					case 'starting2sec':
					case 'running1sec':
						break;
				}
				break;
				
			case 'stopping':
				switch (event)
				{
					case 'running1sec':
						this._state = 'stopped';
						this._hide();
						break;
						
					case 'start':
						this._state = 'running';
						break;
						
					case 'stop':
					case 'starting2sec':
						break;
				}
				break;
		}
	},
	
	_show: function()
	{
		this._scrim.show();
		 Mojo.Controller.appController.showBanner({
		 	messageText: this._message,
		 	icon: "images/notification-small-sync.png"
		 }, null, "scrim");
	},
	
	_hide: function()
	{
		this._scrim.hide();
		 Mojo.Controller.appController.removeBanner("scrim");
	},
});
