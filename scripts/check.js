const fs = require("fs");
const vm = require("vm");

new vm.Script(fs.readFileSync("app.js", "utf8"));
console.log("app.js syntax ok");
