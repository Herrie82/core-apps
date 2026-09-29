/*jslint laxbreak: true, white: false, devel: true */
/*global Class: false, Mojo: false, $L: false, Weave: false, Event: false, Form: false */

/**
 * The ModelObserver provides a mechanism to update the watch for changes to models.
 * When a model is updated, the changes are propograted to any listeners.  However, for
 * efficiency, only active scenes and stages will receieve the update notifications
 * immediately.  Any listeners which is inactive will only receive the changes when they
 * are about to become active.  The goal is to prevent changes progating to inactive scenes
 * when they could cause excessive work which is not immediately useful.
 
Copyright 2009 Palm, Inc.  All rights reserved.

*/
Weave.Models.ModelObserver = 
{
	_token: 1,
	
	_aboutToActivate: function(event)
	{
		var scene = event.target._weave$scene;
		var idx = scene._weave$model$idx;
		for (var mkey in idx) 
		{
			var minfo = idx[mkey];
			if (mkey != 'toJSON') 
			{
				for (var fkey in minfo) 
				{
					var cinfo = minfo[fkey];
					try 
					{
						cinfo.call(cinfo.model, cinfo.old, cinfo.scene);
					} 
					catch (_) 
					{
					}
				}
			}
		}
		scene._weave$model$idx = Weave.Models.ModelObserver._newModelIndex();
	},
	
	cleanup: function(scene)
	{
		this._cleanupScene(scene);
	},
	
	update: function(scene, model, properties, force)
	{
		if (properties === undefined && force === undefined) 
		{
			force = true;
		}
		var r = this.merge(model, properties, force);
		if (force || r.modified) 
		{
			this._notify(scene, model, r.old, 'onchange');
		}
		return r.modified;
	},
	
	merge: function(model, properties, force)
	{
		var modified = false;
		var old = {};
		if (properties) 
		{
			// Copy properties (ignorning _private names and functions)
			for (var key in properties) 
			{
				if (key.charAt(0) != '_') 
				{
					var val = properties[key];
					if (!Object.isFunction(val)) 
					{
						var oval = model[key];
						if (oval != val) 
						{
							old[key] = oval;
							model[key] = val;
							modified = true;
						}
					}
				}
			}
		}
		Mojo.Log.info("MERGE %j %j %j", model, properties, old);
		return {
			modified: modified,
			old: old
		};
	},
	
	externalUpdate: function(scene, model)
	{
		this._notify(scene, model, null, 'onexternalchange');
	},
	
	addUpdateListener: function(scene, model, observer)
	{
		this._addListener(scene, model, observer, 'onchange');
	},
	
	removeUpdateListener: function(scene, model, observer)
	{
		this._removeListener(scene, model, observer, 'onchange');
	},
	
	addExternalUpdateListener: function(scene, model, observer)
	{
		this._addListener(scene, model, observer, 'onexternalchange');
	},
	
	removeExternalUpdateListener: function(scene, model, observer)
	{
		this._removeListener(scene, model, observer, 'onexternalchange');
	},
	
	_addListener: function(scene, model, observer, prop)
	{
		// Every model with listeners holds a set of scenes which are listening to it
		if (!model._weave$model$idx) 
		{
			model._weave$model$token = this._token++;
			model._weave$model$idx = Weave.Models.ModelObserver._newModelIndex();
		}

		if (!scene._weave$model$idx) 
		{
			this._setupScene(scene);
		}
		scene._weave$model$count++;
		
		// Find the calls info related to this specific model+scene combination - creating if necessary
		var info = model._weave$model$idx[scene._weave$model$token];
		if (!info) 
		{
			info = { scene: scene };
			model._weave$model$idx[scene._weave$model$token] = info;
		}
		info[prop] = Weave.Utilities.Fanout.add(info[prop], observer);
	},
	
	_removeListener: function(scene, model, observer, prop)
	{
		if (model._weave$model$idx && scene._weave$model$token) 
		{
			var info = model._weave$model$idx[scene._weave$model$token];
			if (info) 
			{
				if (observer) 
				{
					info[prop] = Weave.Utilities.Fanout.remove(info[prop], observer);
					scene._weave$model$count--;
				}
				else 
				{
					scene._weave$model$count -= Weave.Utilities.Fanout.count(info[prop]);
					delete info[prop];
				}
			}
			if (scene._weave$model$count == 0)
			{
				Mojo.Log.info("CLEANUP", scene._weave$model$token);
				this._cleanupScene(scene);
			}
		}
	},
	
	_notify: function(scene, model, old, call)
	{
		var idx = model._weave$model$idx;
		if (idx) 
		{
			for (var token in idx) 
			{
				var info = idx[token];
				if (info[call]) 
				{
					var ctrl = info.scene.controller;
					if (!ctrl)
					{
						Mojo.Log.error("Attempting to notify a scene without a controller - did you forget to remove a listener? (%s: %j)", token, model);
						delete idx[token];
					}
					else if (!ctrl.isActive || ctrl.isActive()) 
					{
						info[call](model, old, scene);
					}
					else 
					{
						var sidx = info.scene._weave$model$idx;
						var cinfo = sidx[model._weave$model$token];
						if (!cinfo) 
						{
							cinfo = {};
							sidx[model._weave$model$token] = cinfo;
						}
						var ocall = cinfo[call];
						if (!ocall) 
						{
							cinfo[call] = 
							{
								model: model,
								old: old,
								call: info[call],
								scene: scene
							};
						}
						else 
						{
							cinfo[call].old = Object.extend(Object.extend({}, old), ocall.old);
							if (cinfo[call].scene != scene) 
							{
								cinfo[call].scene = null; // If different scenes update, we cannot provide an explicit scene when we callback
							}
						}
					}
				}
			}
		}
	},
	
	_setupScene: function(scene)
	{
		scene._weave$model$token = this._token++;
		scene._weave$model$idx = Weave.Models.ModelObserver._newModelIndex();
		scene._weave$model$count = 0;
		if (scene.controller.sceneElement) 
		{
			scene.controller.sceneElement._weave$scene = scene;
			scene.controller.sceneElement.addEventListener(Mojo.Event.aboutToActivate, this._aboutToActivate);
		}
	},
	
	_cleanupScene: function(scene)
	{
		if (scene.controller.sceneElement) 
		{
			delete scene.controller.sceneElement._weave$scene;
			scene.controller.sceneElement.removeEventListener(Mojo.Event.aboutToActivate, this._aboutToActivate);
		}
		delete scene._weave$model$idx;
		delete scene._weave$model$token;
		delete scene._weave$model$count;
	},

	_newModelIndex: function()
	{
		return { toJSON: function() { return undefined; } };
	},
}
