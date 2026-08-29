import { bulkPutMeals } from '@/db/repositories/meals'
import { addToPlan } from '@/db/repositories/plan'
import { putExtra } from '@/db/repositories/extras'
import { putPull } from '@/db/repositories/pulls'
import { db } from '@/db'
import type { ExtraItem, Ingredient, Meal } from '@/types'

/*
Sample data from the design prototype: 14 real meals with ingredients, stores,
tags and notes. Dev builds only — production starts empty, so the empty states
are what a new install actually sees.

The prototype stored staleness as a `weeksAgo` count; here that is converted to
a real `lastMadeAt` timestamp at seed time, since weeks are always derived.
*/

interface SeedMeal {
	id: string
	name: string
	tags: string[]
	weeksAgo: number
	notes: string
	ingredients: Ingredient[]
}

const SEED_MEALS: SeedMeal[] = [
	{
		id: 'curry',
		name: 'Weeknight red curry',
		tags: ['Thai', 'Quick', 'Dinner'],
		weeksAgo: 2,
		notes:
			'Paste first in the oil, then coconut milk. Double the paste if the jar is old. Rice on before anything else.',
		ingredients: [
			{ name: 'red curry paste', amount: 1, unit: 'jar', store: 'walmart' },
			{ name: 'coconut milk', amount: 2, unit: 'cans', store: 'costco' },
			{ name: 'chicken thighs', amount: 1.5, unit: 'lb', store: 'costco' },
			{ name: 'bell pepper', amount: 2, unit: '', store: 'walmart' },
			{ name: 'jasmine rice', amount: 1, unit: 'bag', store: 'costco' },
			{ name: 'thai basil', amount: 1, unit: 'bunch', store: 'wherever' },
		],
	},
	{
		id: 'sausage',
		name: 'Sheet-pan sausage and peppers',
		tags: ['Italian', 'Quick', 'Dinner'],
		weeksAgo: 6,
		notes: '425 for 30, flip once. Good with the leftover rolls in the freezer.',
		ingredients: [
			{ name: 'italian sausage', amount: 1.5, unit: 'lb', store: 'costco' },
			{ name: 'bell pepper', amount: 3, unit: '', store: 'walmart' },
			{ name: 'red onion', amount: 2, unit: '', store: 'walmart' },
			{ name: 'olive oil', amount: 1, unit: 'bottle', store: 'costco' },
			{ name: 'fennel seed', amount: 1, unit: 'jar', store: 'wherever' },
		],
	},
	{
		id: 'ziti',
		name: 'Baked ziti',
		tags: ['Italian', 'Weekend project', 'Dinner'],
		weeksAgo: 14,
		notes: 'Makes two pans, one goes in the freezer. Ricotta layer in the middle only.',
		ingredients: [
			{ name: 'ziti', amount: 2, unit: 'boxes', store: 'costco' },
			{ name: 'crushed tomatoes', amount: 2, unit: 'cans', store: 'costco' },
			{ name: 'ricotta', amount: 1, unit: 'tub', store: 'costco' },
			{ name: 'mozzarella', amount: 2, unit: 'lb', store: 'costco' },
			{ name: 'ground beef', amount: 1, unit: 'lb', store: 'walmart' },
			{ name: 'garlic', amount: 1, unit: 'head', store: 'walmart' },
		],
	},
	{
		id: 'burrito',
		name: 'Breakfast burrito batch',
		tags: ['Mexican', 'Weekend project', 'Breakfast'],
		weeksAgo: 5,
		notes:
			'Twelve at a time, wrapped in foil then a freezer bag. Eggs slightly under — they finish in the microwave.',
		ingredients: [
			{ name: 'eggs', amount: 2, unit: 'dozen', store: 'costco' },
			{ name: 'flour tortillas', amount: 12, unit: '', store: 'costco' },
			{ name: 'breakfast sausage', amount: 1, unit: 'lb', store: 'walmart' },
			{ name: 'hash browns', amount: 1, unit: 'bag', store: 'costco' },
			{ name: 'cheddar', amount: 1, unit: 'block', store: 'costco' },
			{ name: 'salsa', amount: 1, unit: 'jar', store: 'walmart' },
		],
	},
	{
		id: 'shawarma',
		name: 'Chicken shawarma bowls',
		tags: ['Middle Eastern', 'Quick', 'Dinner'],
		weeksAgo: 20,
		notes:
			'Marinade in the morning, broil at the end for the crisp edges. Garlic sauce is the whole point.',
		ingredients: [
			{ name: 'chicken thighs', amount: 2, unit: 'lb', store: 'costco' },
			{ name: 'plain yogurt', amount: 1, unit: 'tub', store: 'costco' },
			{ name: 'lemons', amount: 3, unit: '', store: 'walmart' },
			{ name: 'cumin', amount: 1, unit: 'jar', store: 'wherever' },
			{ name: 'pita', amount: 1, unit: 'pack', store: 'walmart' },
			{ name: 'cucumber', amount: 2, unit: '', store: 'walmart' },
		],
	},
	{
		id: 'padseeew',
		name: 'Pad see ew',
		tags: ['Thai', 'Quick', 'Dinner'],
		weeksAgo: 31,
		notes: 'Wide noodles from the Asian aisle. Wok as hot as it goes, dark soy for the color.',
		ingredients: [
			{ name: 'wide rice noodles', amount: 1, unit: 'pack', store: 'walmart' },
			{ name: 'dark soy sauce', amount: 1, unit: 'bottle', store: 'walmart' },
			{ name: 'chinese broccoli', amount: 1, unit: 'bunch', store: 'wherever' },
			{ name: 'eggs', amount: 4, unit: '', store: 'costco' },
			{ name: 'chicken breast', amount: 1, unit: 'lb', store: 'costco' },
		],
	},
	{
		id: 'chili',
		name: 'Sunday chili',
		tags: ['American', 'Weekend project', 'Dinner'],
		weeksAgo: 9,
		notes: 'Three hours low. Better the next day, so make it Saturday.',
		ingredients: [
			{ name: 'ground beef', amount: 2, unit: 'lb', store: 'costco' },
			{ name: 'kidney beans', amount: 3, unit: 'cans', store: 'costco' },
			{ name: 'crushed tomatoes', amount: 2, unit: 'cans', store: 'costco' },
			{ name: 'chili powder', amount: 1, unit: 'jar', store: 'wherever' },
			{ name: 'yellow onion', amount: 3, unit: '', store: 'walmart' },
			{ name: 'sour cream', amount: 1, unit: 'tub', store: 'walmart' },
		],
	},
	{
		id: 'greek',
		name: 'Greek salad and pita',
		tags: ['Greek', 'Quick', 'Lunch'],
		weeksAgo: 3,
		notes: 'No lettuce. Cucumber, tomato, feta, big pour of oregano vinaigrette.',
		ingredients: [
			{ name: 'feta', amount: 1, unit: 'block', store: 'costco' },
			{ name: 'cucumber', amount: 3, unit: '', store: 'walmart' },
			{ name: 'tomatoes', amount: 4, unit: '', store: 'walmart' },
			{ name: 'kalamata olives', amount: 1, unit: 'jar', store: 'costco' },
			{ name: 'pita', amount: 1, unit: 'pack', store: 'walmart' },
			{ name: 'red onion', amount: 1, unit: '', store: 'walmart' },
		],
	},
	{
		id: 'salmon',
		name: 'Miso salmon and rice',
		tags: ['Japanese', 'Quick', 'Dinner'],
		weeksAgo: 11,
		notes: 'Miso, mirin, a little sugar. Broil 8 minutes, watch it at the end.',
		ingredients: [
			{ name: 'salmon fillets', amount: 2, unit: 'lb', store: 'costco' },
			{ name: 'white miso', amount: 1, unit: 'tub', store: 'walmart' },
			{ name: 'mirin', amount: 1, unit: 'bottle', store: 'walmart' },
			{ name: 'jasmine rice', amount: 1, unit: 'bag', store: 'costco' },
			{ name: 'scallions', amount: 1, unit: 'bunch', store: 'walmart' },
		],
	},
	{
		id: 'carnitas',
		name: 'Carnitas tacos',
		tags: ['Mexican', 'Weekend project', 'Dinner'],
		weeksAgo: 26,
		notes: 'Pork shoulder, orange, four hours at 300, then crisp under the broiler. Freezes well.',
		ingredients: [
			{ name: 'pork shoulder', amount: 5, unit: 'lb', store: 'costco' },
			{ name: 'corn tortillas', amount: 2, unit: 'packs', store: 'costco' },
			{ name: 'oranges', amount: 3, unit: '', store: 'walmart' },
			{ name: 'white onion', amount: 2, unit: '', store: 'walmart' },
			{ name: 'cilantro', amount: 2, unit: 'bunches', store: 'wherever' },
			{ name: 'limes', amount: 4, unit: '', store: 'walmart' },
		],
	},
	{
		id: 'eggsalad',
		name: 'Egg salad sandwiches',
		tags: ['American', 'Quick', 'Lunch'],
		weeksAgo: 1,
		notes: 'Twelve eggs at once at the start of the week. Dill, mustard, celery.',
		ingredients: [
			{ name: 'eggs', amount: 1, unit: 'dozen', store: 'costco' },
			{ name: 'mayo', amount: 1, unit: 'jar', store: 'costco' },
			{ name: 'celery', amount: 1, unit: 'bunch', store: 'walmart' },
			{ name: 'sandwich bread', amount: 1, unit: 'loaf', store: 'either' },
			{ name: 'dill', amount: 1, unit: 'bunch', store: 'wherever' },
		],
	},
	{
		id: 'risotto',
		name: 'Mushroom risotto',
		tags: ['Italian', 'Weekend project', 'Dinner'],
		weeksAgo: 41,
		notes: 'Dried porcini in the stock. Stand there and stir, it is the whole recipe.',
		ingredients: [
			{ name: 'arborio rice', amount: 1, unit: 'bag', store: 'walmart' },
			{ name: 'cremini mushrooms', amount: 1, unit: 'lb', store: 'costco' },
			{ name: 'dried porcini', amount: 1, unit: 'pack', store: 'wherever' },
			{ name: 'parmesan', amount: 1, unit: 'wedge', store: 'costco' },
			{ name: 'dry white wine', amount: 1, unit: 'bottle', store: 'walmart' },
			{ name: 'shallots', amount: 3, unit: '', store: 'walmart' },
		],
	},
	{
		id: 'oats',
		name: 'Overnight oats',
		tags: ['Quick', 'Breakfast'],
		weeksAgo: 4,
		notes: 'Five jars Sunday night. Oats, milk, chia, whatever fruit is around.',
		ingredients: [
			{ name: 'rolled oats', amount: 1, unit: 'bag', store: 'costco' },
			{ name: 'chia seeds', amount: 1, unit: 'bag', store: 'costco' },
			{ name: 'milk', amount: 1, unit: 'gal', store: 'either' },
			{ name: 'frozen berries', amount: 1, unit: 'bag', store: 'costco' },
			{ name: 'honey', amount: 1, unit: 'jar', store: 'costco' },
		],
	},
	{
		id: 'butterchicken',
		name: 'Butter chicken',
		tags: ['Indian', 'Weekend project', 'Dinner'],
		weeksAgo: 17,
		notes:
			'Yogurt marinade in the morning. Blend the sauce smooth, then the butter goes in off the heat.',
		ingredients: [
			{ name: 'chicken thighs', amount: 2, unit: 'lb', store: 'costco' },
			{ name: 'tomato puree', amount: 2, unit: 'cans', store: 'costco' },
			{ name: 'heavy cream', amount: 1, unit: 'pint', store: 'walmart' },
			{ name: 'garam masala', amount: 1, unit: 'jar', store: 'wherever' },
			{ name: 'ginger', amount: 1, unit: 'knob', store: 'walmart' },
			{ name: 'basmati rice', amount: 1, unit: 'bag', store: 'costco' },
			{ name: 'butter', amount: 1, unit: 'lb', store: 'costco' },
		],
	},
]

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000

/** Meals planned out of the box, so the List tab has something to derive from. */
const SEED_PLAN = ['curry', 'sausage', 'greek']

/*
Of the three planned meals, one has already been pulled onto the shopping list
and one is half pulled, so the "From the plan" section shows all three of its
states at once. A planned meal contributes nothing to the list until it is
pulled, so seeding no pulls at all would leave the shopping list showing only
the extras.
*/
const SEED_PULLS: Record<string, string[] | 'all'> = {
	curry: 'all',
	sausage: ['italian sausage', 'bell pepper'],
}

/**
 * Populate an empty database with sample data. No-ops if anything is already
 * stored, so it never clobbers real work.
 */
export async function seedIfEmpty(): Promise<boolean> {
	if ((await db.meals.count()) > 0) return false
	await reseed()
	return true
}

/** Wipe everything and reinstate the sample data. Exposed in dev settings. */
export async function reseed(): Promise<void> {
	const now = Date.now()

	await db.transaction('rw', [db.meals, db.plan, db.pulls, db.extras, db.checked], async () => {
		await Promise.all([
			db.meals.clear(),
			db.plan.clear(),
			db.pulls.clear(),
			db.extras.clear(),
			db.checked.clear(),
		])
	})

	const meals: Meal[] = SEED_MEALS.map((seed) => ({
		id: seed.id,
		name: seed.name,
		tags: seed.tags,
		notes: seed.notes,
		lastMadeAt: now - seed.weeksAgo * MS_PER_WEEK,
		ingredients: seed.ingredients,
		createdAt: now,
		updatedAt: now,
		archived: false,
	}))

	await bulkPutMeals(meals)

	for (const mealId of SEED_PLAN) {
		await addToPlan(mealId)

		const pulled = SEED_PULLS[mealId]
		if (!pulled) continue

		const meal = meals.find((m) => m.id === mealId)!
		const names = pulled === 'all' ? meal.ingredients.map((i) => i.name) : pulled

		await putPull({
			mealId,
			names: names.map((n) => n.trim().toLowerCase()),
			pulledAt: now,
		})
	}

	// One genuine one-off, plus a shelf of staples — two already on the list, the
	// rest resting, so the Staples shelf has something to demonstrate.
	const extras: Omit<ExtraItem, 'createdAt'>[] = [
		{
			id: 'e1',
			name: 'paper towels',
			qty: '1 pack',
			store: 'costco',
			kind: 'oneoff',
			active: true,
		},
		{
			id: 'e2',
			name: 'coffee beans',
			qty: '2 bags',
			store: 'either',
			kind: 'staple',
			active: true,
		},
		{ id: 'e3', name: 'milk', qty: '1 gal', store: 'either', kind: 'staple', active: false },
		{ id: 'e4', name: 'butter', qty: '1 lb', store: 'costco', kind: 'staple', active: false },
		{
			id: 'e5',
			name: 'sandwich bread',
			qty: '1 loaf',
			store: 'either',
			kind: 'staple',
			active: false,
		},
		{ id: 'e6', name: 'dish soap', qty: '1', store: 'walmart', kind: 'staple', active: false },
	]

	for (const extra of extras) {
		await putExtra({ ...extra, createdAt: now })
	}
}
