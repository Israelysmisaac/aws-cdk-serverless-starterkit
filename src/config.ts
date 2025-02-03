export function interpolateConfig(config: any, input: string): string {
    const placeholderStart = '${self.';
    let result = input;
    let hasReplacements: boolean;
  
    do {
      hasReplacements = false;
      let lastIndex = 0;
      const parts: string[] = [];
  
      while (true) {
        const match = findPlaceholder(result, placeholderStart, lastIndex);
        if (!match) break;
  
        const [fullMatch, keyPath, start, end] = match;
        parts.push(result.substring(lastIndex, start));
  
        // Recursively interpolate the key path itself
        const interpolatedKeyPath = interpolateConfig(config, keyPath);
        
        // Resolve the value from config using the interpolated key path
        const keys = interpolatedKeyPath.split('.');
        let value: any = config;
        for (const key of keys) {
          value = value?.[key];
          if (value === undefined) break;
        }
  
        if (value !== undefined) {
          hasReplacements = true;
          parts.push(value.toString());
        } else {
          parts.push(fullMatch);
        }
  
        lastIndex = end;
      }
  
      parts.push(result.substring(lastIndex));
      result = parts.join('');
    } while (hasReplacements);
    // console.log("res", result)
    return result;
  }
  
function findPlaceholder(str: string, startStr: string, fromIndex: number): null | [string, string, number, number] {
    const startIdx = str.indexOf(startStr, fromIndex);
    if (startIdx === -1) return null;
  
    let balance = 1;
    let currentIdx = startIdx + startStr.length - 1; // Start checking after '${self.'
    
    while (currentIdx < str.length && balance > 0) {
      currentIdx++;
      if (str[currentIdx] === '{') balance++;
      else if (str[currentIdx] === '}') balance--;
    }
  
    if (balance === 0) {
      const endIdx = currentIdx;
      const keyPath = str.substring(startIdx + startStr.length, endIdx);
      return [str.substring(startIdx, endIdx + 1), keyPath, startIdx, endIdx + 1];
    }
  
    return null;
  }