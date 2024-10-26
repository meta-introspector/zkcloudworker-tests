import * as fs from 'fs';
import * as path from 'path';
import * as tar from 'tar';
import * as zlib from 'zlib';

interface ProcessedData {
  directory: string;
  functionSequences: string[][];
}

let functionSums: { [key: string]: { total: number, count: number, min: number, max: number} } = {};
let functionSums2: { [key: string]: { total: number, count: number, min: number, max: number} } = {};

async function processPerfData(rootDir: string): Promise<ProcessedData[]> {
  console.log("processPerfData",rootDir);
  const results: ProcessedData[] = [];

  // Get all subdirectories
  const subdirs = fs.readdirSync(rootDir)
    .map(name => path.join(rootDir, name))
    .filter(dir => fs.statSync(dir).isDirectory());

  for (const subdir of subdirs) {
    console.log("subdir",subdir);
    const perfDataPath = path.join(subdir, 'perf.data.tar.gz');

    if (!fs.existsSync(perfDataPath)) {
      console.log(`No perf.data.tar.gz found in ${subdir}`);
      continue;
    }

    const functionSequences = await processTarGz(perfDataPath);

    for (let functionName in functionSums) {
      console.log("report1",perfDataPath,functionName, functionSums[functionName]);

      let total = functionSums[functionName];
      if (functionSums2[functionName]) {
	functionSums2[functionName].total += total.total;
	functionSums2[functionName].count += total.count;
	functionSums2[functionName].min = Math.min(functionSums2[functionName].min, total.total);
	functionSums2[functionName].max = Math.max(functionSums2[functionName].max, total.total);
      }
      else {
	functionSums2[functionName] = {
	  count : total.count,
	  total: total.total,
	  min: total.min,
	  max: total.max,
	}
      }
    } 
    
    functionSums= {}; // reset
    
    results.push({
      directory: subdir,
      functionSequences
    });

  }

  return results;
}




function process(profile:any, start:number): any {
  let node = profile.nodes[start];
  let total = {
    total: 0,
    count: 0,
    min: Number.MAX_VALUE,
    max: Number.MIN_VALUE 
  };
  if (node) {
    total.total = node.hitCount;
    total.count = 1;
    total.min = node.hitCount;
    total.max = node.hitCount;
    if (node.children) {
      for (const child of node.children) {

	let  res = process(profile, child);
	total.total += res.total;
	total.count += res.count;	
	total.min = Math.min(total.min, res.min);
	total.max = Math.max(total.max, res.max); 
      }
      //console.log(node.callFrame.functionName,total);
      if (node.callFrame && node.callFrame.functionName) {
	let functionName = node.callFrame.functionName;
	if (functionSums[functionName]) {
	  functionSums[functionName].total += total.total;
	  functionSums[functionName].count += 1;
	  functionSums[functionName].min = Math.min(functionSums[functionName].min, total.total);
	  functionSums[functionName].max = Math.max(functionSums[functionName].max, total.total);
	}
	else {
	  functionSums[functionName] = {
	    count : total.count,
	    total: total.total,
	    min: total.min,
	    max: total.max,
	  }
	}
      }
    }
  }

  return total;
}



async function processTarGz(tarPath: string): Promise<string[][]> {
  const functionSequences: string[][] = [];
  const fileContents = new Map<string, Buffer>();
  await new Promise((resolve, reject) => {
    const extract = tar.extract();

    const fileStream = fs.createReadStream(tarPath).pipe(zlib.createGunzip());
    extract.on('entry', async (header, stream, next) => {
      if (header.type === 'File' && header.path.endsWith('cpuprofile')) {
	const chunks: any[] = [];
	if (header) {
	  header.on('data', (chunk:any) =>{
	    chunks.push(Buffer.from(chunk))
	  });
	  header.on('end', () =>{
	    let jsonContent:string = Buffer.concat(chunks).toString("utf-8");
	    //console.log(jsonContent);
	    const profile = JSON.parse(jsonContent);
	    //console.log(profile);
	    //console.log(profile.nodes[0]);
	    let res = process(profile,0);
	    console.log(header.path,res);

	  });

	}
      }
    });
    extract.on('finish', resolve);
    extract.on('error', reject);
    fileStream.pipe(extract);
  });

  // Process files in sorted order
  const sortedFiles = Array.from(fileContents.keys()).sort();

  for (const fileName of sortedFiles) {
    const content = fileContents.get(fileName)!;

    try {
      const jsonContent = content.toString('utf8');
      const profile = JSON.parse(jsonContent);


      console.log(profile);
    } catch (error) {
      console.warn(`Failed to process ${fileName}: ${error}`);
      continue;
    }
  }

  return functionSequences;
}
async function extractTarGz(tarPath: string, extractPath: string): Promise<void> {
  console.log("extractTarGz",tarPath);
  return new Promise((resolve, reject) => {

    //fs.mkdirSync(extractPath, { recursive: true });

    fs.createReadStream(tarPath)
      .pipe(zlib.createGunzip())
      .pipe(tar.extract({ cwd: extractPath }))
      .on('end', resolve)
      .on('error', reject);
  });
}

function isJsonFile(filePath: string): boolean {
  console.log("isjsonfile",filePath);
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch {
    return false;
  }
}

async function readJsonFile(filePath: string): Promise<any> {
  const content = await fs.promises.readFile(filePath, 'utf8');
  return JSON.parse(content);
}


// Example usage
async function main() {
  try {
    const rootDirectory = './data2/';
    const results = await processPerfData(rootDirectory);

    // Output results
    for (const result of results) {
      console.log(`\nDirectory: ${result.directory}`);
      console.log('Function Sequences:');
      result.functionSequences.forEach((sequence, index) => {
	console.log(`\nSequence ${index + 1}:`);
	console.log(sequence.join(' -> '));
      });
    }
  } catch (error) {
    console.error('Error processing performance data:', error);
  }

  for (let functionName in functionSums2) {
    console.log("sum",functionName, functionSums2[functionName]);
  }

}

// Run the script
main();
