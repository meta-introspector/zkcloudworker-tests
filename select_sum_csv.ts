//import * as fs from 'fs';
import * as path from 'path';
import { finished } from "node:stream/promises";
import { parse, transform, stringify } from "csv";

// type Stats = {
//   total: number;
//   count: number;
//   //            min: number;
//   //            max: number;
// };

// type FunctionStatsWithGit = {
//     [key: string]: {
//         [gitUrl: string]: Stats
//     }
// };

async function processPerfData2(rootDir: string, functionSums:FunctionStatsWithGit) {
  console.log("processPerfData", rootDir);
  const subdirs = fs.readdirSync(rootDir)
    .map(name => path.join(rootDir, name))
    .filter(dir => fs.statSync(dir).isDirectory());
  //console.log("processPerfData", subdirs);
  const files: string[] = [];
  for (const subdir of subdirs) {
    const perfDataPath = path.join(subdir, 'perf.data.tar.gz.csv');
    if (!fs.existsSync(perfDataPath)) {
      console.log(`No 'perf.data.tar.gz.csv' found in ${subdir}`);
      continue;
    } else {
      files.push(perfDataPath);
    }
  }
  //  console.log("processPerfData", files);
  const processingPromises = files.map(file => processCsv(file, functionSums));
  try {
    const results = await Promise.allSettled(processingPromises);
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        //console.log(`Successfully processed file: ${files[index]}`);
      } else {
        console.error(`Error processing file: ${files[index]} - ${result.reason}`);
      }
    });    
    //console.log("Total function stats collected:", total);
  } catch (error) {
    console.error('Error processing directory:', error);
    throw error;
  }
  console.log("finished",Object.keys(functionSums).length );
  //console.log("finished",functionSums);
}

// from https://stackoverflow.com/questions/68856528/javascript-regex-to-split-camel-case-string
function camelCaseSplit(str:string): string[] {
  let ret = str.replace(/[\-\.::\/_]/g,' ').replace(/(?<=[a-z\d])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/g, ' ')
  return ret.split(" ");
}


function process_record (record:string[4], functionSums:FunctionStatsWithGit){
  if (record[0] == "function_name") // header
    {    
    }
  else {
    let fname = record[0];
    let git_url  = record[1];
    let total_count = Number(record[2]);
    let  row_count = Number(record[3]);
    let  min_count = Number(record[4]);
    let  max_count = Number(record[5]);
    //    console.log("test",record);
    let results: { [key: string]: number } = {};
    results[fname]=1; // process the full name
    let split1 = camelCaseSplit (fname);
    for (let n in split1) {
      results[split1[n]]=1;       // and its parts
    }	
    for (let name in results) {      
      if (!functionSums[name]) {
	functionSums[name]={};
      }
      if (!functionSums[name][git_url]) {
	functionSums[name][git_url]={
	  count : Number(row_count),
	  total : Number(total_count)
	}
      } else {
	functionSums[name][git_url].count += row_count;
	functionSums[name][git_url].total += total_count;
      }
    }
    //console.log("functionSums",name,git_url,functionSums[name][git_url]);
  }
}

async function processCsv(csvPath: string,functionSums:FunctionStatsWithGit) {
  //console.log("processCsv", csvPath);
  function foo(x:any){
    //console.log("record",x);
    process_record(x, functionSums)    
  }
  await new Promise(async (resolve, reject) => {
    try {
      //console.log("processCsvstart", csvPath);
      //await finished(
      const stream = fs.createReadStream(csvPath)
	.pipe(parse())
	.pipe(transform(foo));
      
      stream.on('finish', () => {
	//console.log("processCsv1", csvPath, functionSums);
        //console.log("Stream finished");
        resolve(undefined);
      });
      // Handle stream errors
      stream.on('error', (error) => {
        console.error("Stream error:", error);
        reject(error);
      });
      
      //console.log("processCsv1", csvPath, functionSums);
    } catch (error) {      console.warn(`Failed to process ${csvPath}: ${error}`);    }
    //console.log("processCsv3", csvPath, functionSums);
  }); 
  //console.log("processCsv", csvPath, functionSums);
}


//
import * as fs from 'fs';
import { createObjectCsvWriter } from 'csv-writer';

type Stats = {
  total: number;
  count: number;
  // min: number;
  // max: number;
};

type FunctionStatsWithGit = {
  [key: string]: {
    [gitUrl: string]: Stats;
  };
};

type PivotTable = {
  [functionKey: string]: {
    [gitUrl: string]: number;
  };
};

const pivotFunctionStats = (functionStats: FunctionStatsWithGit): PivotTable => {
  const gitUrls = Object.values(functionStats).reduce((acc, gitStats) => {
    Object.keys(gitStats).forEach((gitUrl) => {
      //console.log(acc,gitUrl);
      //      if (!acc.includes(gitUrl)) {
      acc[gitUrl]={count:1,total:1};
      //}
    });
    return acc;
  }, {});

  const pivotTable: PivotTable = {};

  Object.keys(functionStats).forEach((functionKey) => {
    pivotTable[functionKey] = {};
    for (let gitUrl in gitUrls) {
      const stats = functionStats[functionKey][gitUrl];
      pivotTable[functionKey][gitUrl] = stats ? stats.total : 0;
    }
  });

  return pivotTable;
};

const writePivotTableToCsv = (pivotTable: PivotTable, csvFilePath: string) => {
  const gitUrls = Object.keys(Object.values(pivotTable)[0]);
  const csvWriter = createObjectCsvWriter({
    path: csvFilePath,
    header: [
      { id: 'functionKey', title: 'Function Key' },
      ...gitUrls.map((gitUrl) => ({ id: gitUrl, title: gitUrl })),
    ],
  });

  const records = Object.keys(pivotTable).map((functionKey) => ({
    functionKey,
    ...pivotTable[functionKey],
  }));

  //console.log('table',pivotTable); // has function and columsna dn counts
  console.log('records',records);
  
  csvWriter.writeRecords(records).then(() => {
    console.log('CSV file written successfully!');
  });
};


async function main() {
  const rootDirectory = './data2/';
  let functionSums = {}
  try {
    const results = await processPerfData2(rootDirectory,functionSums);
  } catch (error) {
    console.error('Error processing directory:', error);
    // throw error;
  }
  console.log("sums2",Object.keys(functionSums).length );
  const pivotTable = pivotFunctionStats(functionSums);
  writePivotTableToCsv(pivotTable, 'pivot_table.csv');

}
// Run the script
main();
