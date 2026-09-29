/* Copyright 2009 Palm, Inc.  All rights reserved. */

if (window == window.top) 
{
	var Weave = Weave || {};
	
	(function()
	{
		function load(config)
		{
			for (var prefix in config) 
			{
				if (prefix) 
				{
					Weave[prefix.charAt(0).toUpperCase() + prefix.substring(1)] = {};
				}
				var names = config[prefix];
				for (var i = 0; i < names.length; i++) 
				{
					document.write('<script type="text/javascript" src="weave/' + prefix + '/' + names[i] + '.js"></script' + '>');
				}
			}
		}
		
		load(
		{
			system:         [ 'activator' ],
			models:         [ 'model', 'modelobserver' ],
			services:       [ 'services', 'serviceobserver', 'applicationmanager' ],
			utilities:      [ 'fanout', 'regexp', 'appmenu', 'scrim' ],
		});
		
	})();
}
