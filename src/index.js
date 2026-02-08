
// this is the build for webpack and UMD builds
// try not to use this!
import Lua from './lua'

import browserCookie from './stores/browser-cookie'
import local from './stores/local'
import memory from './stores/memory'

// UTM and Personalization modules (IIFE pattern - self-register on window)
// These files populate window.LuaUTM and window.LuaPersonalize on execution
import './utm'
import './personalization'

export default Lua

const stores = {
  browserCookie: browserCookie(),
  local: local(),
  memory: memory(),
}

window.Lua = Lua
Lua.stores = stores

// Attach UTM and Personalization from window globals (populated by IIFEs)
Lua.utm = window.LuaUTM || {}
Lua.personalization = window.LuaPersonalize || {}