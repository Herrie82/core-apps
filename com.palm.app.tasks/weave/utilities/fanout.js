/*jslint laxbreak: true, white: false, devel: true */
/*global Class: false, Mojo: false, $L: false, Weave: false, Event: false, Form: false */

/* Copyright 2009 Palm, Inc.  All rights reserved. */

Weave.Utilities.Fanout =
{
	add: function (first, second)
	{
		if (!second) 
		{
			return first;
		}
		else if (!first) 
		{
			return second;
		}
		else if (first.add) 
		{
			return first.add(second);
		}
		else 
		{
			var outs = [];
			
			function fanout()
			{
				var len = outs.length;
				for (var i = 0; i < len; i++) 
				{
					outs[i].apply(null, arguments);
				}
			};
			
			Object.extend(fanout, 
			{
				add: function(call)
				{
					outs.push(call);
					return this;
				},
				
				remove: function(call)
				{
					var len = outs.length;
					for (var i = 0; i < len; i++) 
					{
						if (outs[i] == call) 
						{
							outs.splice(i, 1);
							switch (len)
							{
								case 1:
									return undefined;
								case 2:
									return outs[0];
								default:
									return this;
							}
						}
					}
					return this;
				},
				
				count: function()
				{
					return outs.length;
				},
			});
			
			return fanout.add(first).add(second);
		}
	},
		
	remove: function(first, second)
	{
		if (first == second)
		{
			return undefined;
		}
		else if (first.remove && second)
		{
			return first.remove(second);
		}
		else
		{
			return first;
		}
	},
	
	count: function(func)
	{
		if (!func)
		{
			return 0;
		}
		else if (func.count)
		{
			return func.count();
		}
		else
		{
			return 1;
		}
	},
}
