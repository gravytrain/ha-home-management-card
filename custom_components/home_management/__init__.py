"""Persistent repeating to-do schedules for Home Management Card."""
from __future__ import annotations

from datetime import date
import uuid

import voluptuous as vol

from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.event import async_track_time_change
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import DOMAIN, SERVICE_RUN_SCHEDULES, SERVICE_SCHEDULE_ITEM, STORAGE_KEY, STORAGE_VERSION

WEEKDAYS = ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday")
SCHEDULE_SCHEMA = vol.Schema({
    vol.Required("list_entity"): cv.entity_id,
    vol.Required("item"): cv.string,
    vol.Required("recurrence"): vol.In(("daily", "weekdays")),
    vol.Optional("weekdays", default=[]): vol.All(cv.ensure_list, [vol.In(WEEKDAYS)]),
})


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Set up the schedule engine without requiring YAML configuration."""
    store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
    data = await store.async_load() or {"schedules": [], "materialized": {}}
    hass.data[DOMAIN] = {"store": store, "data": data}

    async def async_materialize(today: date | None = None) -> None:
        current = today or dt_util.now().date()
        date_key = current.isoformat()
        schedules = hass.data[DOMAIN]["data"]["schedules"]
        materialized = hass.data[DOMAIN]["data"].setdefault("materialized", {})
        for schedule in schedules:
            weekdays = schedule.get("weekdays", [])
            matches = schedule["recurrence"] == "daily" or WEEKDAYS[current.weekday()] in weekdays
            seen = materialized.setdefault(schedule["id"], [])
            if not matches or date_key in seen:
                continue
            await hass.services.async_call(
                "todo", "add_item",
                {"item": schedule["item"], "due_date": date_key},
                target={"entity_id": schedule["list_entity"]}, blocking=True,
            )
            seen.append(date_key)
        # Preserve enough history to prevent duplicate current-day materialization after a restart.
        cutoff = (current.toordinal() - 14)
        for key, values in materialized.items():
            materialized[key] = [value for value in values if date.fromisoformat(value).toordinal() >= cutoff]
        await store.async_save(hass.data[DOMAIN]["data"])

    async def handle_schedule(call: ServiceCall) -> None:
        schedule = {
            "id": uuid.uuid4().hex,
            "list_entity": call.data["list_entity"],
            "item": call.data["item"],
            "recurrence": call.data["recurrence"],
            "weekdays": call.data["weekdays"],
        }
        hass.data[DOMAIN]["data"]["schedules"].append(schedule)
        await store.async_save(hass.data[DOMAIN]["data"])
        await async_materialize()

    async def handle_run(call: ServiceCall) -> None:
        await async_materialize()

    hass.services.async_register(DOMAIN, SERVICE_SCHEDULE_ITEM, handle_schedule, schema=SCHEDULE_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_RUN_SCHEDULES, handle_run)
    async_track_time_change(hass, lambda now: async_materialize(now.date()), hour=0, minute=0, second=5)
    await async_materialize()
    return True
