// simple post processing system
const fs = require('fs');
const readline = require('readline');
const file = readline.createInterface({
    input: fs.createReadStream('report3.txt'),
    output: process.stdout,
    terminal: false
});

file.on('line', (line:string) => {
  if (line.startsWith("report1") ) {
    line = line.replace("}","");
    let parts = line.split(" ");
    let name = parts[1];
    let name2 = parts[2];
    let values = parts.slice(3).join(" ");
    let values2 = values.split(",")
    let res = []
    //console.log("values2:",values2)
    for (let v in values2){
      v = values2[v]
      v = v.replace("NaN","0");
      let g = v.split(":");
      if (res.length <4){
	res.push(Number(g[1]))
      }
    }
    console.log(name + "\t" + name2 + "\t"+ res.join("\t"))
  }  
});
