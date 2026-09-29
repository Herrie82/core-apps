/*jslint laxbreak: true, white: false, devel: true */
/*global Class: false, Mojo: false, $L: false, Template: false, Event: false, Form: false */
/**
 * Model provides a basic observable model type.
 * Essentially a model is a set of properties, together with methods
 * to allow the model to be observered and updated.
 * 
 * See ModelObserver for more information.
 
Copyright 2009 Palm, Inc.  All rights reserved.

*/
Weave.Models.Model = Class.create(
{
	initialize: function(properties)
	{
		if (properties)
		{
			for (var key in properties)
			{
				if (key.indexOf('_weave$') != 0)
				{
					this[key] = properties[key];
				}
			}
		}
	},
	
	update: function(scene, properties, force)
	{
		return Weave.Models.ModelObserver.update(scene, this, properties, force);
	},
	
	merge: function(properties)
	{
		return Weave.Models.ModelObserver.merge(this, properties);
	},
	
	externalUpdate: function(scene)
	{
		Weave.Models.ModelObserver.externalUpdate(scene, this);
	},
	
	addUpdateListener: function(scene, observer)
	{
		Weave.Models.ModelObserver.addUpdateListener(scene, this, observer);
	},
	
	removeUpdateListener: function(scene, observer)
	{
		Weave.Models.ModelObserver.removeUpdateListener(scene, this, observer);
	},
	
	addExternalUpdateListener: function(scene, observer)
	{
		Weave.Models.ModelObserver.addExternalUpdateListener(scene, this, observer);
	},
	
	removeExternalUpdateListener: function(scene, observer)
	{
		Weave.Models.ModelObserver.removeExternalUpdateListener(scene, this, observer);
	},
});
