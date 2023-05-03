function WrapComponent(fn) {
  return {
    name: fn.name,
    setup: fn,
    inheritAttrs: false,
  }
}

export default WrapComponent
