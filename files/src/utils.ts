export function replaceUrl(url: string, variables: Record<string, string | number>) {
  return Object.keys(variables).reduce<string>((str, key) => {
    return str.replace(`{${key}}`, variables[key].toString())
  }, url)
}