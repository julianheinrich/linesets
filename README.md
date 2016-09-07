# Linesets - Linear Diagrams for Sets

This implementation is based on the work of [Peter Rodgers](https://www.cs.kent.ac.uk/people/staff/pjr/linear/).

# API

To create a linear bar diagram, you need to provide an array of arrays (see the [basic example](examples/Basic/index.html)):

```
var zones = [["A"], ["C"], ["A","B"], ["B","C"]];
var ld = d3.linearDiagram()("#example")
			.zones(zones)
  			.render();
```
