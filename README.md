Conclusion Label Select
=============

## Description
An extension of the label selector widget.

## Features:
On top of the features available in the basic widget:
- Data source microflow: retrieve the available labels through a microflow
- Remove missing: if the label was not found, and 'create new' is turned off, you can choose to remove/show the label.
- Missing validation: if the label was not found, and 'create new' is turned off, you can show a customized validation message.
- Case sensitivity: employ a native option in the plugin to disable case senstivity when checking for duplicates
- Allow white spaces: allow tags with white spaces in them, without having to "quote" the label

## Limitations
- Color for 'missing labels' not yet customizable
- 

## Dependencies

- [Mendix 6.x or higher](https://appstore.mendix.com/).
- [jQuery](https://jquery.com/)
- [jQuery UI](https://jqueryui.com/), custom build containing Widget, Position and Autocomplete components and the Blind and Highlight effects.
- [Tag-it](http://aehlke.github.io/tag-it/) jQuery plugin 

## Configuration

Add the .mpk to your project.
Add the widget to a dataview and follow the configuration steps.
