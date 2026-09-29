/*jslint laxbreak: true, white: false, devel: true */
/*global Class: false, Mojo: false, $L: false, Weave: false, Event: false, Form: false */

/* Copyright 2009 Palm, Inc.  All rights reserved. */

Weave.Services.ApplicationManager =
{	
	_target: 'palm://com.palm.applicationManager',
	
	getInstalledApplications: function(callback)
	{
		Weave.Services.request(this._target, 
		{
			method: 'listApps',
			parameters: {},
		},
		function(response)
		{
			Mojo.Log.info("GET INSTALLED APPLICATIONS %j", response);
			callback(true, response.apps);
		},
		function()
		{
			callback(false);
		});
	},
	
	openApplication: function(name, params)
	{
		Weave.Services.request(this._target, 
		{
			method: 'open',
			parameters: 
			{
				id: name,
				params: params
			}
		});
	},
	
	installApplication: function(url, callback)
	{
		var self = this;
		Weave.Services.request(self._target, 
		{
			method: 'open',
			parameters: 
			{
				target: url,
				subscribe: true
			},
		},
		function(response)
		{
			Mojo.Log.info("installApplication %j", response);
			if (response.status == 'SUCCESS') 
			{
				callback(true);
			}
			else if (response.status && response.status.indexOf('FAILED_') == 0) 
			{
				callback(false, response.status);
			}
			else 
			{
			// Ignore - and don't callback
			}
		},
		function(response)
		{
			Mojo.Log.info("FAILED %j", response);
			callback(false, 'FAILED');
		});
	},
	
	watchForApplicationChanges: function(scene, callback, backoff)
	{
		return new Weave.Services.ServiceObserver(scene, this._target + "/launchPointChanges", {}, function()
		{
			callback && callback(true);
		}, backoff);
	},
};