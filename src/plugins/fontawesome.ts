/*
FontAwesome free, registered icon by icon so the bundle only carries what the
app actually renders. Add an import + a `library.add()` entry when a new icon
is needed; never pull in a whole icon pack.
*/
import { library } from '@fortawesome/fontawesome-svg-core'
import {
	faCheck,
	faChevronDown,
	faGear,
	faMagnifyingGlass,
	faPen,
	faPlus,
	faShuffle,
	faTrash,
	faXmark,
} from '@fortawesome/free-solid-svg-icons'

library.add(
	faCheck,
	faChevronDown,
	faGear,
	faMagnifyingGlass,
	faPen,
	faPlus,
	faShuffle,
	faTrash,
	faXmark,
)
