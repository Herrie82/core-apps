/*jslint laxbreak: true, white: false, devel: true */
/*global Class: false, Mojo: false, $L: false, Weave: false, Event: false, Form: false, setTimeout: false, clearTimeout: false */
/**
 * The ServiceObserver will watch a given service URL and execute the callback when it
 * sends new data.  However, it also implements a throttling strategy on these callbacks
 * to prevent it swamping the system with interrupts that are not immediately interesting.
 * The backoff strategy (which is configurable) essentially manages the time between
 * interrupts depending on the state of the scene they're destined for.
 
Copyright 2009 Palm, Inc.  All rights reserved.

*/
Weave.Services.ServiceObserver = Class.create(
{
	_mode: 'none',
	_send: 0,
	_pending: null,
	_timeout: null,
	
	initialize: function(scene, url, args, callback, backoff)
	{
		this._scene = scene;
		this._callback = function(a, b) { Mojo.Log.info("**CALLBACK**"); callback(a, b); };
		this._backoff = this._normalizeBackoff(backoff);
		
		this._run = this._run.bind(this);
		
		var self = this;
		var first = true;

var target=url.replace(/palm:\/\/[A-Z|.]*\//i, "");
url=url.substring(0,url.length - (target.length));
		
		this._req = Weave.Services.request(url, 
		{
			parameters: Object.extend(args || {}),
			method: target,
			subscribe: true
		},
		function(response)
		{
			//--Mojo.Log.info('============= SERVICE CALLBACK %j', response);
			if (first) 
			{
				// Ignore the first callback (it will call us back immediately)
				first = false;
			}
			else 
			{
				self._delaycallback({ status: true, response: response }, 0);
			}
		},
		function(response)
		{
			self._last = null;
			self._callback(false);
		});
		
		this._start();
	},
	
	stop: function()
	{
		if (this._scene.controller.document) 
		{
			this._scene.controller.document.removeEventListener(Mojo.Event.activate, this._fromcard);
			this._scene.controller.document.removeEventListener(Mojo.Event.deactivate, this._tocard);
		}
		if (this._scene.controller.sceneElement) 
		{
			this._scene.controller.sceneElement.removeEventListener(Mojo.Event.activate, this._toactive);
			this._scene.controller.sceneElement.removeEventListener(Mojo.Event.deactivate, this._toinactive);
		}
		delete this._req;
	},
	
	signal: function()
	{
		this._delaycallback({ status: true, response: null }, 0);
	},
	
	_normalizeBackoff: function(backoff)
	{
		backoff = Object.extend({ active: 1, inactive: -1, card: 30 }, backoff || {});
		backoff.card$active = backoff.card$active || backoff.card;
		backoff.card$inactive = backoff.card$inactive || backoff.card;
		return backoff;
	},
	
	_start: function()
	{
		this._fromcard = (function() { this._changeMode(this._mode.substring(5)); }).bind(this);
		this._tocard = (function() { this._changeMode('card$' + this._mode); }).bind(this);
		this._toactive = (function() { this._changeMode('active'); }).bind(this);
		this._toinactive = (function() { this._changeMode('inactive'); }).bind(this);

		if (this._scene.controller.document) 
		{
			this._scene.controller.document.addEventListener(Mojo.Event.activate, this._fromcard);
			this._scene.controller.document.addEventListener(Mojo.Event.deactivate, this._tocard);
		}
		if (this._scene.controller.sceneElement) 
		{
			this._scene.controller.sceneElement.addEventListener(Mojo.Event.activate, this._toactive);
			this._scene.controller.sceneElement.addEventListener(Mojo.Event.deactivate, this._toinactive);
		}
		this._changeMode('active');
	},
	
	_delaycallback: function(event, elapsed)
	{
		var timeout = this._backoff[this._mode];
		//--Mojo.Log.info("delaycallback %d %d", this._timeout, timeout);
		if (timeout >= 0 && !this._timeout)
		{
			timeout *= 1000;
			if (elapsed === 0 || elapsed >= timeout)
			{
				if (event)
				{
					if (timeout > 0)
					{
						this._timeout = setTimeout(this._run, timeout);
						this._start = new Date().getTime();
					}
					this._callback(event.status, event.response);
				}
			}
			else
			{
				this._timeout = setTimeout(this._run, timeout - elapsed);
				this._start = new Date().getTime();
				this._last = event;
			}
		}
		else
		{
			this._last = event;
		}
	},
	
	_run: function()
	{
		this._timeout = null;
		var event = this._last;
		if (event)
		{
			this._last = null;
			if (this._backoff[this._mode] > 0)
			{
				this._timeout = setTimeout(this._run, this._backoff[this._mode] * 1000);
				this._start = new Date().getTime();
			}
			this._callback(event.status, event.response);
		}
	},
	
	_changeMode: function(mode)
	{
		//--Mojo.Log.info("CHANGING MODE %s -> %s", this._mode, mode);
		if (mode != this._mode)
		{
			this._mode = mode;
			
			// If the timer is running, work out how long its been running for and stop it
			var elapsed = 0;
			if (this._timeout)
			{
				clearTimeout(this._timeout);
				this._timeout = null;
				elapsed = new Date().getTime() - this._start;
			}
			
			// Resend any pending event in the new mode
			var event = this._last;
			this._last = null;
			this._delaycallback(event, elapsed);
		}
	},
	
	toJSON: function()
	{
		return "<Weave.Services.ServiceObserver>";
	}
});
