# Authored MicroW8 carts (source)

The 24 `*.cwa` files here are the CurlyWas source for the demoscene effects
authored for this project (the other 8 carts in `../carts/` are MicroW8's own
example prods, source in the MicroW8 v0.4.1 release). Public domain (Unlicense).

Rebuild a cart with the MicroW8 `uw8` tool (from the v0.4.1 release):

    uw8 pack -l 9 plasma.cwa ../carts/plasma.uw8

The browser host (`demo-layer.js`) loads only the packed `../carts/*.uw8`; it
cannot compile CurlyWas, so these sources are kept purely for regenerability.
Verify a rebuilt cart animates before shipping it (see faust/demo-layer-test.js).
