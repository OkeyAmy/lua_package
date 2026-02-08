
// this is the build for webpack and UMD builds
// try not to use this!
import Lua from './lua'

import browserCookie from './stores/browser-cookie'
import local from './stores/local'
import memory from './stores/memory'

export default Lua

const stores = {
  browserCookie: browserCookie(),
  local: local(),
  memory: memory(),
}

window.Lua = Lua
Lua.stores = stores
