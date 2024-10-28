import * as fs from 'fs';
import * as path from 'path';
import * as tar from 'tar';
import * as zlib from 'zlib';
import { writeFileSync } from 'node:fs';
import { ParquetSchema, ParquetWriter, ParquetReader } from 'parquets';

interface ProcessedData {
  directory: string;
  functionSequences: string[][];
}
// Define the expanded type with git URL
type Stats = {
            total: number;
            count: number;
            min: number;
            max: number;
};

type FunctionStatsWithGit = {
    [key: string]: {
        [gitUrl: string]: Stats
    }
};

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

    await processTarGz(perfDataPath);   

  }

  return results;
}


function process(tarpath:string, profile:any, start:number, depth:number, functionSums:FunctionStatsWithGit): Stats {
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
	let  res = process(tarpath, profile, child, depth+1, functionSums);
	total.total += res.total;
	total.count += res.count;	
	total.min = Math.min(total.min, res.min);
	total.max = Math.max(total.max, res.max); 
      }
      //console.log(node.callFrame.functionName,total);
      if (node.callFrame && node.callFrame.functionName) {
	let functionName = node.callFrame.functionName;
	if (!functionSums[tarpath]) {
	  functionSums[tarpath]={};
	}
	if (functionSums[tarpath][functionName]) {
	  functionSums[tarpath][functionName].total += total.total;
	  functionSums[tarpath][functionName].count += 1;
	  functionSums[tarpath][functionName].min = Math.min(functionSums[tarpath][functionName].min, total.total);
	  functionSums[tarpath][functionName].max = Math.max(functionSums[tarpath][functionName].max, total.total);
	}
	else {
	  functionSums[tarpath][functionName] = {
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

async function writeFunctionStatsToParquet(
    stats: FunctionStatsWithGit,
    outputPath: string
): Promise<void> {
    // Define the schema for our parquet file
    const schema = new ParquetSchema({
        function_name: { type: 'UTF8' },
        git_url: { type: 'UTF8' },
      total_count: { type: 'DOUBLE' },
        row_count: { type: 'INT64' },
        min_count: { type: 'DOUBLE' },
        max_count: { type: 'DOUBLE' },
      //        avg_time: { type: 'DOUBLE' },
      //        timestamp: { type: 'INT64' }
    });

    // Create a new ParquetWriter instance
    const writer = await ParquetWriter.openFile(schema, outputPath);

    // Flatten the nested structure and write rows
    const currentTimestamp = Date.now();
    
    for (const [gitUrl, funcNames] of Object.entries(stats)) {
        for (const [funcName, metrics] of Object.entries(funcNames)) {
            const row = {
                function_name: funcName,
                git_url: gitUrl,
                total_count: metrics.total,
                row_count: metrics.count,
                min_count: metrics.min,
                max_count: metrics.max,
	      //                avg_time: metrics.total / metrics.count,
	      //                timestamp: currentTimestamp
            };
            
            await writer.appendRow(row);
        }
    }

    // Close the writer when done
    await writer.close();
}

function writeFunctionStatsToCSV(stats: FunctionStatsWithGit, outputPath: string): void {
    const rows: string[] = ['function_name,git_url,total_count,row_count,min_count,max_count'];
    
    for (const [gitUrl, funcNames] of Object.entries(stats)) {
        for (const [funcName, metrics] of Object.entries(funcNames)) {
            rows.push(`"${funcName}","${gitUrl}",${metrics.total},${metrics.count},${metrics.min},${metrics.max}`);
        }
    }
    
    writeFileSync(outputPath, rows.join('\n'));
}

function writeFunctionStatsToJSON(stats: FunctionStatsWithGit, outputPath: string): void {
    const flattenedData = [];
    
    for (const [gitUrl, funcNames] of Object.entries(stats)) {
        for (const [funcName, metrics] of Object.entries(funcNames)) {
            flattenedData.push({
                function_name: funcName,
                git_url: gitUrl,
                total_count: metrics.total,
                row_count: metrics.count,
                min_count: metrics.min,
                max_count: metrics.max
            });
        }
    }
    
    writeFileSync(outputPath, JSON.stringify(flattenedData, null, 2));
}

async function processTarGz(tarpath: string): Promise<string[][]> {
  const functionSequences: string[][] = [];
  const fileContents = new Map<string, Buffer>();
  await new Promise((resolve, reject) => {
    const extract = tar.extract();
    const fileStream = fs.createReadStream(tarpath).pipe(zlib.createGunzip());
    extract.on('entry', async (header, stream, next) => {
      if (header.type === 'File' && header.path.endsWith('cpuprofile')) {
	const chunks: any[] = [];
	if (header) {
	  header.on('data', (chunk:any) =>{
	    chunks.push(Buffer.from(chunk))
	  });
	  header.on('end', () =>{
	    let jsonContent:string = Buffer.concat(chunks).toString("utf-8");
	    const profile = JSON.parse(jsonContent);
	    let report = {};
	    let res = process(tarpath,profile,0,0,report);
	    console.log("check",tarpath + ".parquet");
	    writeFunctionStatsToCSV(report,tarpath + ".csv");
	    writeFunctionStatsToParquet(report,tarpath + ".parquet");
	    writeFunctionStatsToJSON(report,tarpath + ".json");
	    
	    //console.log(header.path,res);
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

      //console.log(profile);
    } catch (error) {
      console.warn(`Failed to process ${fileName}: ${error}`);
      continue;
    }
  }

  return functionSequences;
}
async function extractTarGz(tarpath: string, extractPath: string): Promise<void> {
  console.log("extractTarGz",tarpath);
  return new Promise((resolve, reject) => {
    //fs.mkdirSync(extractPath, { recursive: true });
    fs.createReadStream(tarpath)
      .pipe(zlib.createGunzip())
      .pipe(tar.extract({ cwd: extractPath }))
      .on('end', resolve)
      .on('error', reject);
  });
}

async function main() {
    const rootDirectory = './data2/';
    const results = await processPerfData(rootDirectory);
};

main();
