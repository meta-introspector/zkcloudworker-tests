import * as fs from 'fs';
import * as path from 'path';
import { ParquetSchema, ParquetWriter, ParquetReader } from 'parquets';

//let functionSums: { [key: string]: { total: number, count: number, min: number, max: number} } = {};

type Stats = {
  total: number;
  count: number;
  //            min: number;
  //            max: number;
};

type FunctionStatsWithGit = {
    [key: string]: {
        [gitUrl: string]: Stats
    }
};

async function processPerfDataOld(rootDir: string)  {
  console.log("processPerfData",rootDir);

  const subdirs = fs.readdirSync(rootDir)
    .map(name => path.join(rootDir, name))
    .filter(dir => fs.statSync(dir).isDirectory());
  let files:string[] = [];
  for (const subdir of subdirs) {
    //    console.log("subdir",subdir);
    const perfDataPath = path.join(subdir, 'perf.data.tar.gz.parquet');

    
    if (!fs.existsSync(perfDataPath)) {
      console.log(`No 'perf.data.tar.gz.parquet' found in ${subdir}`);
      continue;
    }
    else {
      files.push(perfDataPath);
    }


      // try {
      // 	console.log("test",perfDataPath);

      // 	//console.log("after",perfDataPath);
      // 	//console.log("total",res, total);
      // }  catch (error) {
      // 	console.error('Error processing performance data:', error);
      // }
      
  }

  let total = {};
  const processingPromises = files.map(file => processParquet(file, total)  );
  // Wait for all files to be processed
  console.log("files",processingPromises);
  console.log("waiting");
  try {
    Promise.allSettled(processingPromises).then((results) =>
      results.forEach((result) => console.log(result.status)),
    );
    //const results = await
    Promise.all(processingPromises).then((values)=>{
      console.log("DEBUG",values);
    })
    
    //let rest2 = await results;
    console.log("total",total);
  } catch (error) {
    console.error('Error processing directory:', error);
    throw error;
 }
  //  console.log("files",processingPromises);  
}


async function processPerfData2(rootDir: string) {
  console.log("processPerfData", rootDir);

  const subdirs = fs.readdirSync(rootDir)
    .map(name => path.join(rootDir, name))
    .filter(dir => fs.statSync(dir).isDirectory());

  const files: string[] = [];
  for (const subdir of subdirs) {
    const perfDataPath = path.join(subdir, 'perf.data.tar.gz.parquet');

    if (!fs.existsSync(perfDataPath)) {
      console.log(`No 'perf.data.tar.gz.parquet' found in ${subdir}`);
      continue;
    } else {
      files.push(perfDataPath);
    }
  }

  const total: FunctionStatsWithGit = {};
  const processingPromises = files.map(file => processParquet(file, total));

    console.log("processingPromises",processingPromises);

  try {
    // Wait for all files to be processed
    const results = await Promise.allSettled(processingPromises);
      console.log("results",results);	
    results.forEach((result, index) => {
          console.log("result",result);	
      if (result.status === 'fulfilled') {
        console.log(`Successfully processed file: ${files[index]}`);
      } else {
        console.error(`Error processing file: ${files[index]} - ${result.reason}`);
      }
    });
    
    console.log("Total function stats collected:", total);
  } catch (error) {
    console.error('Error processing directory:', error);
    throw error;
  }
  console.log("finished",total);	
}

// from https://stackoverflow.com/questions/68856528/javascript-regex-to-split-camel-case-string
function camelCaseSplit(str:string): string[] {
  let ret = str.replace(/[\-\.::\/_]/g,' ').replace(/(?<=[a-z\d])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/g, ' ')
  //console.log("DEBUG2",ret);
  return ret.split(" ");
}


async function processParquet(parquetPath: string,functionSums:FunctionStatsWithGit) {
  const functionSequences: string[][] = [];
  const fileContents = new Map<string, Buffer>();

  await new Promise(async (resolve, reject) => {
    //console.log("reading",parquetPath);
    try {
      const reader = await ParquetReader.openFile(parquetPath);
      const cursor = reader.getCursor();
      let record = null;
      while (record = await cursor.next()) {
      	    //console.log(record);
	let fname = record.function_name;
	let git_url = record.git_url;
	
	let count = record.row_count;
	let total = record.total_count;
	
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
	      count : count,
	      total : total
	    }
	  } else {
	    functionSums[name][git_url].count += count;
	    functionSums[name][git_url].total += total;
	  }
	}	
      }
      
      
      await reader.close();
    }  catch (error) {
      console.error('Error processing performance data:', parquetPath, error);
    }

    //    console.log("sums2",functionSums);
  });
}

async function main() {
  const rootDirectory = './data2/';
  const results = await processPerfData2(rootDirectory);
}
// Run the script
main();
