export async function renderKy(templateUrl: string, data: any, parentContext?: Record<string, any>): Promise<string> {
  const response = await fetch(templateUrl);
  if (!response.ok) throw new Error(`Failed to load template: ${templateUrl} (${response.status})`);
  const templateText = await response.text();
  return renderTemplateString(templateText, data, new URL(templateUrl, window.location.href).href, parentContext);
}

// Store state for each component
const componentStates = new Map<string, any>();

async function renderTemplateString(
  template: string, 
  data: any, 
  baseUrl: string,
  parentContext?: Record<string, any>
): Promise<string> {
  // Remove multi-line comments first
  template = template.replace(/\/\*[\s\S]*?\*\//g, '');
  
  // Remove single-line comments
  template = template.replace(/\/\/.*$/gm, '');

  // 1. Extract and execute <useLogic> blocks to build context
  let logicBlocks: string[] = [];
  template = template.replace(/<useLogic>([\s\S]*?)<\/useLogic>/g, (_, code) => {
    // Remove comments from logic blocks as well
    code = code.replace(/\/\*[\s\S]*?\*\//g, '');
    code = code.replace(/\/\/.*$/gm, '');
    logicBlocks.push(code);
    return '';
  });

  // Create a scoped context that preserves parent variables but allows local overrides
  const context: Record<string, any> = {
    _parent: parentContext || {}, // Store parent context for reference
    ...(parentContext || {}),    // Include parent variables
    ...data                      // Override with current template data
  };

  // Execute logic blocks to modify context
  logicBlocks.forEach((code, index) => {
    try {
      // Log the code being executed for debugging
      console.log('Executing useLogic block:', {
        index,
        code: code.trim(),
        context: Object.keys(context)
      });

      // Clean the code to convert variable declarations to context assignments
      const cleanedCode = code
        .replace(/\b(let|const|var)\s+([a-zA-Z0-9_$]+)\s*=/g, 'context.$2 =')
        .replace(/\b(function|const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*\(/g, 'context.$2 = function(')
        .replace(/\b([a-zA-Z0-9_$]+)\s*\+\+/g, 'context.$1++')
        .replace(/\b([a-zA-Z0-9_$]+)\s*--/g, 'context.$1--')
        .replace(/\b([a-zA-Z0-9_$]+)\s*\+=/g, 'context.$1 +=')
        .replace(/\b([a-zA-Z0-9_$]+)\s*-=/g, 'context.$1 -=');

      console.log('Cleaned code:', cleanedCode);

      // Execute the code in the context
      const executeInContext = new Function('context', `
        with (context) {
          ${cleanedCode}
        }
        return context;
      `);

      // Execute and merge variables into main context
      const newVars = executeInContext(context);
      console.log('Context after execution:', {
        index,
        context: Object.keys(context),
        newVars: Object.keys(newVars),
      });

      // Update component state if we have a component ID
      const componentIdMatch = template.match(/data-component-id="([^"]+)"/);
      const componentId = componentIdMatch ? componentIdMatch[1] : null;
      if (componentId) {
        const componentState = componentStates.get(componentId);
        if (componentState) {
          // Preserve functions when updating state
          Object.keys(newVars).forEach(key => {
            if (typeof newVars[key] === 'function') {
              componentState.state[key] = newVars[key];
              context[key] = newVars[key];
            } else {
              componentState.state[key] = newVars[key];
              context[key] = newVars[key];
            }
          });
        }
      }
    } catch (e) {
      // Enhanced error reporting
      console.error('Error in useLogic block:', {
        blockIndex: index + 1,
        code: code.trim(),
        cleanedCode: code.trim().replace(/\b(let|const|var)\s+([a-zA-Z0-9_$]+)\s*=/g, 'context.$2 ='),
        error: e,
        context: Object.keys(context)
      });
      throw new Error(`Error in useLogic block ${index + 1}: ${(e as Error).message}\nCode:\n${code.trim()}`);
    }
  });

  // Find component ID if present
  const componentIdMatch = template.match(/data-component-id="([^"]+)"/);
  const componentId = componentIdMatch ? componentIdMatch[1] : null;

  // Store component state if component ID is present
  if (componentId) {
    const existingState = componentStates.get(componentId);
    componentStates.set(componentId, {
      url: baseUrl,
      data: { ...context },
      state: existingState ? { ...existingState.state, ...context } : { ...context }
    });
  }

  // 2. Handle imports, automatically passing all context variables
  const importPattern = /{{\s*import\s+['"]?([^'"]+)['"]?\s*(?:with\s+({[\s\S]*?}))?\s*}}/g;
  let match: RegExpExecArray | null;
  while ((match = importPattern.exec(template)) !== null) {
    const [full, importPath, importDataStr] = match;
    let importData: any = {};
    
    // Evaluate the import path
    let resolvedImportPath = importPath;
    try {
      // Remove quotes if present
      const cleanPath = importPath.replace(/['"]/g, '');
      
      // If it's not a direct path (doesn't start with ./ or /), evaluate it as a variable
      if (!cleanPath.startsWith('./') && !cleanPath.startsWith('/')) {
        const pathValue = new Function('context', `with (context) { return ${cleanPath}; }`)(context);
        if (!pathValue) {
          console.warn(`Import path variable ${cleanPath} not found in context`);
          continue;
        }
        resolvedImportPath = pathValue;
      } else {
        resolvedImportPath = cleanPath;
      }
      
      console.log('Import path resolution:', {
        original: importPath,
        clean: cleanPath,
        resolved: resolvedImportPath
      });
    } catch (e) {
      console.error(`Error evaluating import path ${importPath}:`, e);
      continue;
    }
    
    // If import has explicit data, merge it with context
    if (importDataStr) {
      try {
        const explicitData = new Function('context', `with (context) { return ${importDataStr}; }`)(context);
        importData = { ...context, ...explicitData }; // Merge context with explicit data
      } catch (e) {
        throw new Error(`Invalid import data for ${resolvedImportPath}: ${(e as Error).message}`);
      }
    } else {
      // If no explicit data, use all context variables
      importData = { ...context };
    }

    console.log('Importing template:', {
      originalPath: importPath,
      resolvedPath: resolvedImportPath,
      data: importData,
      context: Object.keys(context)
    });

    const resolvedUrl = new URL(resolvedImportPath, baseUrl).href;
    const importedHtml = await renderKy(resolvedUrl, importData, context);
    
    // After importing, merge any new context variables back
    const importedContext = { ...importData };
    Object.assign(context, importedContext);
    
    template = template.replace(full, importedHtml);
    importPattern.lastIndex = 0;
  }

  // 3. Build render function body
  let code = '';
  const parts = template.split(/({{[\s\S]+?}})/g);
  for (const part of parts) {
    if (part && part.startsWith('{{') && part.endsWith('}}')) {
      const expr = part.slice(2, -2).trim();
      if (expr.startsWith('if ')) {
        code += `if (${expr.slice(3)}) {\n`;
      } else if (expr.startsWith('else if ')) {
        code += `} else if (${expr.slice(8)}) {\n`;
      } else if (expr === 'else') {
        code += `} else {\n`;
      } else if (expr === '/if') {
        code += `}\n`;
      } else if (expr.startsWith('forEach ')) {
        const [arrayExpr, itemVar] = expr.slice(8).trim().split(/\s+as\s+/);
        code += `for (const ${itemVar} of context['${arrayExpr}'] || []) {\n`;
      } else if (expr === '/forEach') {
        code += `}\n`;
      } else {
        // Handle function calls and variable access
        if (expr.includes('(')) {
          // Function call
          const funcName = expr.split('(')[0];
          code += `output += (context['${funcName}']?.() ?? '');\n`;
        } else if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(expr)) {
          // Simple variable
          console.log('Accessing variable:', expr, 'Value:', context[expr]);
          code += `output += (context['${expr}'] ?? '');\n`;
        } else if (expr.includes('.')) {
          // Object property access
          const parts = expr.split('.');
          const objName = parts[0];
          const propPath = parts.slice(1).join('.');
          code += `output += (context['${objName}']?.['${propPath}'] ?? '');\n`;
        } else {
          // Fallback to context access
          code += `output += (context['${expr}'] ?? '');\n`;
        }
      }
    } else if (part) {
      code += `output += ${JSON.stringify(part)};\n`;
    }
  }

  // Create the render function with proper context access
  const renderCode = `
    let output = "";
    console.log('Render context:', context);
    with (context) {
      ${code}
    }
    return output;
  `;

  try {
    const renderFn = new Function('context', renderCode);
    const html = renderFn(context);

    // Auto-bind event handlers
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    // Log available functions in context
    console.log('Available functions in context:', 
      Object.keys(context).filter(key => typeof context[key] === 'function')
    );

    // Bind dynamic events using @ syntax
    const elements = tempDiv.querySelectorAll('*');
    elements.forEach(el => {
      // Get all attributes that start with @
      Array.from(el.attributes).forEach(attr => {
        if (attr.name.startsWith('@')) {
          const eventName = attr.name.slice(1); // Remove @ prefix
          const handlerName = attr.value; // Get handler name directly
          
          console.log('Found event binding:', {
            element: el.tagName,
            eventName,
            handlerName,
            context: Object.keys(context),
            isFunction: typeof context[handlerName] === 'function'
          });

          // List of valid DOM events
          const validEvents = [
            'click', 'dblclick', 'mouseover', 'mouseout', 'mousedown', 'mouseup',
            'keydown', 'keyup', 'keypress', 'submit', 'change', 'input', 'focus',
            'blur', 'load', 'unload', 'resize', 'scroll'
          ];

          if (!validEvents.includes(eventName)) {
            console.error(`Invalid event name: ${eventName}. Must be one of: ${validEvents.join(', ')}`);
            return;
          }

          if (handlerName && typeof context[handlerName] === 'function') {
            console.log(`Binding ${eventName} event to handler ${handlerName}`);
            // Wrap the event handler to trigger re-render
            const originalHandler = context[handlerName];
            el.addEventListener(eventName, async (event) => {
              try {
                console.log(`Executing ${handlerName} handler`);
                // Execute the handler and get the result
                const result = await originalHandler.call(context, event);
                console.log('Handler result:', result);
                
                // Update component state if we have a component ID
                if (componentId) {
                  const componentState = componentStates.get(componentId);
                  if (componentState) {
                    // Update the state with any changes from the handler
                    if (result !== undefined) {
                      // Update both state and context
                      Object.assign(componentState.state, result);
                      Object.assign(context, result);
                      
                      // Re-render the component
                      const newHtml = await renderKy(componentState.url, componentState.state);
                      const container = document.querySelector(`[data-component-id="${componentId}"]`);
                      if (container) {
                        // Preserve event listeners by only updating the content
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = newHtml;
                        const newContent = tempDiv.firstElementChild;
                        if (newContent) {
                          container.innerHTML = '';
                          container.appendChild(newContent);
                        }
                      }
                    }
                  }
                }
              } catch (error) {
                console.error(`Error in event handler ${handlerName}:`, error);
              }
            });
          } else {
            console.error(`Handler function "${handlerName}" not found in context. Available functions:`, 
              Object.keys(context).filter(key => typeof context[key] === 'function')
            );
          }
        }
      });
    });

    return tempDiv.innerHTML;
  } catch (e) {
    throw new Error(`Error rendering template: ${(e as Error).message}\nGenerated code:\n${renderCode}`);
  }
}