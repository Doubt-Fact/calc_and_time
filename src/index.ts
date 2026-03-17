#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ============ 工具输入模式定义 ============

// 1. 计算模块 - 表达式计算
const CalculateExpressionSchema = z.object({
  expression: z.string().describe("数学表达式，支持加减乘除、括号、百分比等")
});

// 2. 计算模块 - 单位换算
const UnitConversionSchema = z.object({
  value: z.number().describe("要转换的数值"),
  from: z.enum(["m", "km", "cm", "mm", "celsius", "fahrenheit", "kelvin", "sqm", "sqkm", "sqcm"]).describe("原始单位"),
  to: z.enum(["m", "km", "cm", "mm", "celsius", "fahrenheit", "kelvin", "sqm", "sqkm", "sqcm"]).describe("目标单位")
});

// 2. 日期与时间模块
const GetCurrentDateTimeInputSchema = z.object({
  format: z.string().optional().describe("日期时间格式，默认为 'yyyy-MM-dd HH:mm:ss'")
});

// 3. 时间戳转换模块
const TimestampConversionInputSchema = z.object({
  timestamp: z.number().optional().describe("时间戳（秒）"),
  datetime: z.string().optional().describe("日期时间字符串，格式如 '2026-01-16 14:25:07'")
});

// 4. 日期运算模块 - 日期加减
const DateArithmeticSchema = z.object({
  datetime: z.string().describe("起始日期时间，格式如 '2026-01-16 14:25:07'"),
  years: z.number().optional().default(0).describe("年数偏移，正数为加，负数为减"),
  months: z.number().optional().default(0).describe("月数偏移，正数为加，负数为减"),
  days: z.number().optional().default(0).describe("天数偏移，正数为加，负数为减"),
  hours: z.number().optional().default(0).describe("小时偏移，正数为加，负数为减"),
  minutes: z.number().optional().default(0).describe("分钟偏移，正数为加，负数为减"),
  seconds: z.number().optional().default(0).describe("秒数偏移，正数为加，负数为减"),
  format: z.string().optional().default("yyyy-MM-dd HH:mm:ss").describe("输出日期时间格式")
});

// 5. 日期运算模块 - 日期差值
const DateDifferenceSchema = z.object({
  datetime1: z.string().describe("第一个日期时间，格式如 '2026-01-16 14:25:07'"),
  datetime2: z.string().describe("第二个日期时间，格式如 '2026-01-17 15:30:08'"),
  unit: z.enum(["days", "hours", "minutes", "seconds"]).default("days").describe("差值单位：days(天数)、hours(小时数)、minutes(分钟数)、seconds(秒数)")
});

// 6. 随机数模块
const RandomNumberInputSchema = z.object({
  min: z.number().default(0).describe("最小值"),
  max: z.number().default(100).describe("最大值"),
  count: z.number().default(1).describe("生成数量"),
  decimalPlaces: z.number().default(0).describe("保留小数位数")
});

// ============ MCP 服务器实例 ============
const mcpServer = new McpServer({
  name: "calc_and_time",
  version: "1.0.0",
});

// ============ 工具实现函数 ============

// 1. 计算模块实现
function calculate(expression: string): { result: number; expression: string } {
  try {
    // 处理百分比
    let processedExpr = expression.replace(/(\d+(\.\d+)?)%/g, '($1/100)');
    
    // 安全的数学表达式求值
    const result = Function('"use strict"; return (' + processedExpr + ')')();
    
    return {
      result: typeof result === 'number' ? result : NaN,
      expression: expression
    };
  } catch (error) {
    return {
      result: NaN,
      expression: expression
    };
  }
}

// 单位换算
function unitConversion(value: number, from: string, to: string): { result: number; from: string; to: string; value: number } {
  let result = value;

  // 长度单位换算
  const lengthUnits = ['m', 'km', 'cm', 'mm'];
  if (lengthUnits.includes(from) && lengthUnits.includes(to)) {
    // 先转换为米
    let inMeters = value;
    switch (from) {
      case 'km': inMeters = value * 1000; break;
      case 'cm': inMeters = value / 100; break;
      case 'mm': inMeters = value / 1000; break;
    }
    // 从米转换为目标单位
    switch (to) {
      case 'km': result = inMeters / 1000; break;
      case 'cm': result = inMeters * 100; break;
      case 'mm': result = inMeters * 1000; break;
      default: result = inMeters;
    }
  }

  // 温度单位换算
  const tempUnits = ['celsius', 'fahrenheit', 'kelvin'];
  if (tempUnits.includes(from) && tempUnits.includes(to)) {
    // 先转换为摄氏度
    let inCelsius = value;
    switch (from) {
      case 'fahrenheit': inCelsius = (value - 32) * 5 / 9; break;
      case 'kelvin': inCelsius = value - 273.15; break;
    }
    // 从摄氏度转换为目标单位
    switch (to) {
      case 'fahrenheit': result = inCelsius * 9 / 5 + 32; break;
      case 'kelvin': result = inCelsius + 273.15; break;
      default: result = inCelsius;
    }
  }

  // 面积单位换算
  const areaUnits = ['sqm', 'sqkm', 'sqcm'];
  if (areaUnits.includes(from) && areaUnits.includes(to)) {
    // 先转换为平方米
    let inSqm = value;
    switch (from) {
      case 'sqkm': inSqm = value * 1000000; break;
      case 'sqcm': inSqm = value / 10000; break;
    }
    // 从平方米转换为目标单位
    switch (to) {
      case 'sqkm': result = inSqm / 1000000; break;
      case 'sqcm': result = inSqm * 10000; break;
      default: result = inSqm;
    }
  }

  return { result, from, to, value };
}

// 2. 日期与时间模块实现
function getCurrentDateTime(format: string = 'yyyy-MM-dd HH:mm:ss'): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return format
    .replace('yyyy', String(year))
    .replace('MM', month)
    .replace('dd', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
}

// 辅助函数：格式化日期
function formatDate(date: Date, format: string): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return format
    .replace('yyyy', String(year))
    .replace('MM', month)
    .replace('dd', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
}

// 5. 日期运算模块实现 - 日期加减
function dateArithmetic(
  datetime: string,
  years: number,
  months: number,
  days: number,
  hours: number,
  minutes: number,
  seconds: number,
  format: string
): { original: string; result: string; offset: any } {
  const date = new Date(datetime);
  
  // 添加年月日时分秒
  date.setFullYear(date.getFullYear() + years);
  date.setMonth(date.getMonth() + months);
  date.setDate(date.getDate() + days);
  date.setHours(date.getHours() + hours);
  date.setMinutes(date.getMinutes() + minutes);
  date.setSeconds(date.getSeconds() + seconds);

  return {
    original: datetime,
    result: formatDate(date, format),
    offset: { years, months, days, hours, minutes, seconds }
  };
}

// 6. 日期运算模块实现 - 日期差值
function dateDifference(datetime1: string, datetime2: string, unit: string): {
  datetime1: string;
  datetime2: string;
  difference: number;
  unit: string;
  absoluteDifference: number;
} {
  const date1 = new Date(datetime1);
  const date2 = new Date(datetime2);
  
  const diffMs = date2.getTime() - date1.getTime();
  let difference: number;
  
  switch (unit) {
    case 'days':
      difference = diffMs / (1000 * 60 * 60 * 24);
      break;
    case 'hours':
      difference = diffMs / (1000 * 60 * 60);
      break;
    case 'minutes':
      difference = diffMs / (1000 * 60);
      break;
    case 'seconds':
      difference = diffMs / 1000;
      break;
    default:
      difference = diffMs / (1000 * 60 * 60 * 24);
  }

  return {
    datetime1,
    datetime2,
    difference: Number(difference.toFixed(2)),
    unit,
    absoluteDifference: Number(Math.abs(difference).toFixed(2))
  };
}

// 3. 时间戳转换模块实现
function timestampToDateTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function dateTimeToTimestamp(datetime: string): number {
  const date = new Date(datetime);
  return Math.floor(date.getTime() / 1000);
}

// 4. 随机数模块实现
function generateRandomNumbers(min: number, max: number, count: number, decimalPlaces: number): number[] {
  const results: number[] = [];
  for (let i = 0; i < count; i++) {
    const randomValue = Math.random() * (max - min) + min;
    const roundedValue = Number(randomValue.toFixed(decimalPlaces));
    results.push(roundedValue);
  }
  return results;
}

// ============ 注册工具 ============

// 1. 计算工具 - 表达式计算
mcpServer.registerTool(
  "calculate_expression",
  {
    description: "计算数学表达式，支持加减乘除、括号、百分比等常用计算",
    inputSchema: CalculateExpressionSchema,
  },
  async (input: any) => {
    const result = calculate(input.expression);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);

// 2. 计算工具 - 单位换算
mcpServer.registerTool(
  "unit_conversion",
  {
    description: "单位换算，支持长度、温度、面积等单位之间的转换",
    inputSchema: UnitConversionSchema,
  },
  async (input: any) => {
    const result = unitConversion(input.value, input.from, input.to);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);

// 2. 日期与时间工具
mcpServer.registerTool(
  "get_current_datetime",
  {
    description: "获取当前日期与时间",
    inputSchema: GetCurrentDateTimeInputSchema,
  },
  async (input: any) => {
    const result = getCurrentDateTime(input.format);
    return {
      content: [
        {
          type: "text",
          text: result,
        },
      ],
    };
  }
);

// 3. 时间戳转换工具
mcpServer.registerTool(
  "timestamp_conversion",
  {
    description: "时间戳与日期时间相互转换",
    inputSchema: TimestampConversionInputSchema,
  },
  async (input: any) => {
    if (input.timestamp !== undefined) {
      const result = timestampToDateTime(input.timestamp);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ timestamp: input.timestamp, datetime: result }, null, 2),
          },
        ],
      };
    } else if (input.datetime) {
      const result = dateTimeToTimestamp(input.datetime);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ datetime: input.datetime, timestamp: result }, null, 2),
          },
        ],
      };
    } else {
      return {
        content: [
          {
            type: "text",
            text: "请提供 timestamp 或 datetime 参数中的一个",
          },
        ],
      };
    }
  }
);

// 5. 日期运算工具 - 日期加减
mcpServer.registerTool(
  "date_arithmetic",
  {
    description: "日期加减运算，支持对日期进行年、月、日、时、分、秒的加减操作",
    inputSchema: DateArithmeticSchema,
  },
  async (input: any) => {
    const result = dateArithmetic(
      input.datetime,
      input.years || 0,
      input.months || 0,
      input.days || 0,
      input.hours || 0,
      input.minutes || 0,
      input.seconds || 0,
      input.format || 'yyyy-MM-dd HH:mm:ss'
    );
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);

// 6. 日期运算工具 - 日期差值
mcpServer.registerTool(
  "date_difference",
  {
    description: "计算两个日期之间的差值，支持按天、小时、分钟、秒为单位返回",
    inputSchema: DateDifferenceSchema,
  },
  async (input: any) => {
    const result = dateDifference(
      input.datetime1,
      input.datetime2,
      input.unit || 'days'
    );
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);

// 7. 随机数生成工具
mcpServer.registerTool(
  "generate_random_numbers",
  {
    description: "生成随机数，支持定义最大最小、生成数量、保留几位小数",
    inputSchema: RandomNumberInputSchema,
  },
  async (input: any) => {
    const result = generateRandomNumbers(
      input.min,
      input.max,
      input.count,
      input.decimalPlaces
    );
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            min: input.min,
            max: input.max,
            count: input.count,
            decimalPlaces: input.decimalPlaces,
            numbers: result
          }, null, 2),
        },
      ],
    };
  }
);

// ============ 启动服务器 ============
async function startServer() {
  try {
    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);
    
    process.on("SIGINT", async () => {
      await mcpServer.close();
      process.exit(0);
    });
    
    process.on("SIGTERM", async () => {
      await mcpServer.close();
      process.exit(0);
    });
    
  } catch (error) {
    process.exit(1);
  }
}

startServer();