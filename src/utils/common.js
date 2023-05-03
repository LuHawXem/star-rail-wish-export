export function flat(arr) {
  let res = [];
  for (let i = 0; i < arr.length; i++) {
    if (Array.isArray(arr[i])) {
      res.push(...flat(arr[i]));
    } else {
      res.push(arr[i]);
    }
  }
  return res;
}