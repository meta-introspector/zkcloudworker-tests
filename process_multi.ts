import * as fs from 'fs';
import { writeFileSync } from 'node:fs';
//import * as arrow from 'apache-arrow';
import * as avro from 'avsc';
import { ParquetSchema, ParquetWriter, ParquetReader } from 'parquets';
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

// Add new serialization functions alongside the existing Parquet writer
async function writeMultiFormatStats(
    stats: FunctionStatsWithGit,
    baseOutputPath: string
): Promise<void> {
    // Write Parquet as before
    await writeFunctionStatsToParquet(stats, `${baseOutputPath}.parquet`);
    
    // Write CSV
  //writeStatsToCSV(stats, `${baseOutputPath}.csv`);
    
    // Write JSON
  //writeStatsToJSON(stats, `${baseOutputPath}.json`);
    
    // Write Arrow
  //    await writeStatsToArrow(stats, `${baseOutputPath}.arrow`);
    
    // Write Avro
  //    await writeStatsToAvro(stats, `${baseOutputPath}.avro`);
}


// async function writeStatsToArrow(stats: FunctionStatsWithGit, outputPath: string): Promise<void> {
//     const schema = new arrow.Schema([
//         arrow.Field.new('function_name', new arrow.Utf8()),
//         arrow.Field.new('git_url', new arrow.Utf8()),
//         arrow.Field.new('total_count', new arrow.Float64()),
//         arrow.Field.new('row_count', new arrow.Int64()),
//         arrow.Field.new('min_count', new arrow.Float64()),
//         arrow.Field.new('max_count', new arrow.Float64())
//     ]);
    
//     const records = [];
//     for (const [gitUrl, funcNames] of Object.entries(stats)) {
//         for (const [funcName, metrics] of Object.entries(funcNames)) {
//             records.push({
//                 function_name: funcName,
//                 git_url: gitUrl,
//                 total_count: metrics.total,
//                 row_count: metrics.count,
//                 min_count: metrics.min,
//                 max_count: metrics.max
//             });
//         }
//     }
    
//     const table = arrow.tableFromJSON(records);
//     const writer = fs.createWriteStream(outputPath);
//     await arrow.RecordBatchWriter.writeAll(table).then(buffer => {
//         writer.write(buffer);
//         writer.end();
//     });
// }

// async function writeStatsToAvro(stats: FunctionStatsWithGit, outputPath: string): Promise<void> {
//     const avroSchema = {
//         type: 'record',
//         name: 'FunctionStats',
//         fields: [
//             { name: 'function_name', type: 'string' },
//             { name: 'git_url', type: 'string' },
//             { name: 'total_count', type: 'double' },
//             { name: 'row_count', type: 'long' },
//             { name: 'min_count', type: 'double' },
//             { name: 'max_count', type: 'double' }
//         ]
//     };
    
//   const type = avro.Type.forSchema(avroSchema);
//     const writer = fs.createWriteStream(outputPath);
    
//     for (const [gitUrl, funcNames] of Object.entries(stats)) {
//         for (const [funcName, metrics] of Object.entries(funcNames)) {
//             const record = {
//                 function_name: funcName,
//                 git_url: gitUrl,
//                 total_count: metrics.total,
//                 row_count: metrics.count,
//                 min_count: metrics.min,
//                 max_count: metrics.max
//             };
            
//             writer.write(type.toBuffer(record));
//         }
//     }
    
//     writer.end();
// }

// Add validation functions to help detect corruption
async function validateOutputFiles(baseOutputPath: string): Promise<boolean> {
    const results = {
        parquet: await validateParquetFile(`${baseOutputPath}.parquet`),
        csv: validateCSVFile(`${baseOutputPath}.csv`),
        json: validateJSONFile(`${baseOutputPath}.json`),
      //        arrow: await validateArrowFile(`${baseOutputPath}.arrow`),
      //        avro: await validateAvroFile(`${baseOutputPath}.avro`)
    };
    
    console.log('Validation Results:', results);
    return Object.values(results).every(result => result === true);
}

async function validateParquetFile(path: string): Promise<boolean> {
    try {
        const reader = await ParquetReader.openFile(path);
        const cursor = reader.getCursor();
        let rowCount = 0;
        while (cursor.next()) {
            rowCount++;
        }
        await reader.close();
        return rowCount > 0;
    } catch (error) {
        console.error('Parquet validation error:', error);
        return false;
    }
}

function validateCSVFile(path: string): boolean {
    try {
        const content = fs.readFileSync(path, 'utf8');
        const lines = content.split('\n');
        return lines.length > 1 && lines[0].includes('function_name');
    } catch (error) {
        console.error('CSV validation error:', error);
        return false;
    }
}

function validateJSONFile(path: string): boolean {
    try {
        const content = fs.readFileSync(path, 'utf8');
        const data = JSON.parse(content);
        return Array.isArray(data) && data.length > 0;
    } catch (error) {
        console.error('JSON validation error:', error);
        return false;
    }
}

// async function validateArrowFile(path: string): Promise<boolean> {
//     try {
//         const buffer = fs.readFileSync(path);
//         const table = await arrow.tableFromIPC(buffer);
//         return table.numRows > 0;
//     } catch (error) {
//         console.error('Arrow validation error:', error);
//         return false;
//     }
// }

// async function validateAvroFile(path: string): Promise<boolean> {
//     try {
//         const buffer = fs.readFileSync(path);
//         const type = avro.Type.forSchema(avroSchema);
//         const decoded = type.fromBuffer(buffer);
//         return decoded !== null;
//     } catch (error) {
//         console.error('Avro validation error:', error);
//         return false;
//     }
// }

// Modify the process function to use the new multi-format writer
// function process(tarpath: string, profile: any, start: number, depth: number, functionSums: FunctionStatsWithGit): Stats {
//     // ... (existing process function code remains the same) ...
    
//     // Modify the part where it writes the output
//   //if (node.callFrame && node.callFrame.functionName) {
//         // ... (existing code) ...
        
//         // Write to multiple formats
//         const baseOutputPath = tarpath.replace('.tar.gz', '');
//         await writeMultiFormatStats(functionSums, baseOutputPath);
        
//         // Validate the output files
//         const isValid = await validateOutputFiles(baseOutputPath);
//         if (!isValid) {
//             console.error('Data validation failed for:', baseOutputPath);
//         }
//     }
    
//     return total;
// }
