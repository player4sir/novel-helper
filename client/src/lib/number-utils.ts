/**
 * Convert number to Chinese characters
 * 将数字转换为中文数字
 */
export function numberToChinese(num: number): string {
  const digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  const units = ['', '十', '百', '千'];
  
  if (num === 0) return digits[0];
  if (num < 0 || num > 9999) return num.toString(); // 超出范围使用阿拉伯数字
  
  // 特殊处理 10-19
  if (num >= 10 && num < 20) {
    return '十' + (num % 10 === 0 ? '' : digits[num % 10]);
  }
  
  // 特殊处理 1-9
  if (num < 10) {
    return digits[num];
  }
  
  let result = '';
  let numStr = num.toString();
  let len = numStr.length;
  
  for (let i = 0; i < len; i++) {
    const digit = parseInt(numStr[i]);
    const unit = units[len - i - 1];
    
    if (digit === 0) {
      // 处理零的情况
      if (result[result.length - 1] !== digits[0] && i < len - 1) {
        result += digits[0];
      }
    } else {
      result += digits[digit] + unit;
    }
  }
  
  // 移除末尾的零
  result = result.replace(/零+$/, '');
  
  return result;
}

/**
 * Generate chapter title with Chinese number
 * 生成带中文数字的章节标题
 */
export function generateChapterTitle(chapterNumber: number, subtitle: string = '未命名'): string {
  return `第${numberToChinese(chapterNumber)}章 ${subtitle}`;
}
