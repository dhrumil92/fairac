...admin page ui polish karvanu che

responsive
...circuit diagram for iot

console ni errors solve karvani che

host karvani che


server na badha sql queries aapi ne puchvanu che k load che k nai??

at the end -> security check (attack + manual check)
plus jovanu che k console ma kai sensetive data print to nathi thatu ne? 

badha edge cases mangavna che antigravity pase thi.

-------
app
------
*invite notification nu ui fix karvanu che
*who hs started the session who joined when, who left when, (like a timeline)
*Dhrumil(12:00)Joined-----*Dev(12:04)Joined-----*Dhrumil(1:00)left-----*siddh(1:00)Joined-----*(3:00)end
Dhrumil-60 min
Dev-180 min
Siddh-120 min
so 1:3:2

*try connnecting the app with ac and turn off the interrnet and starrt the session-> and check it works or not

*in specific session history card, add actual usage parameter, if the used amount if less than 100w, and energy charged write in that 100w(0.100kWh)
if the actual used is more than 100w (let 580w) then both will be showing same (580w) or 0.580kWh

*add continues stick notification which shows uptime, money spent, kwh used and a stop button in it

*add downlod receipt button to downlod pdf receipt for specific session

*add download receipt button in the page to download all the history/ whole ledger

*extend the session (manage the running session)

*add from to date in wallet screen filter as well as in session screen 

*add support page

*if ac is running and suddenly power outage occurs, then will ac session continue just after the electricity comes back?? even after just 2 minutes, the electricity gets gone, then will it resume the session??
*so when it happens it should terminate all the sessions and should settle the amount into the wallet
so it will prevent the ac compressor if the electricity again comes back within 5 minutes, so resuming just after electricity comes back is not suggested

*one test: when the ac session is running and the member is the active participant to the session try to recharge the wallet

*do not allow 15 users to start the ac at the same time
do not send the start command to the wt32 from server all at once for all 15 rooms
instead make a queue and send start command to wt32 one by one

-------------------

*iso app banavvani che

*add payment gateway

*add ir sensor to turn off the ac

*add the voice assisted feature so tahat i can just tell
hey google/alexa turn he ac on/off the ac for 2 hours

---------------RISKS & FIXES---------------
1. The Clock Outage Risk (Timestamp Corruption)
The Risk: The ESP32 does not have an internal battery. It relies on the internet (NTP) to know what time it is. If the internet router dies and the city power cuts at the exact same time, the ESP32 boots up with no internet. It will think the year is 1970. All the backup billing data it saves to LittleFS will have broken timestamps, ruining your database when it finally uploads.
The Fix: Add a DS3231 RTC (Real Time Clock) module to your motherboard. It costs about ₹80, connects to the same I2C pins as your port expander, and has a tiny coin-cell battery. It guarantees the ESP32 always knows the exact time, even during a total blackout with no internet.

4. The Single Power Supply Failure
The Risk: Your entire motherboard (the WT32, the H-Bridges, the MAX485) all run off one single 12V/5V power adapter inside the box. If a massive lightning strike burns out that one cheap power adapter, the whole board dies.
The Fix: Do not use a cheap black plastic wall adapter inside the panel. Buy a high-quality industrial DIN-rail power supply (like a Mean Well HDR-15-12). They cost a bit more, but they are built to survive massive voltage surges and last 10+ years in factory environments.
-----------------------------------------

*github profile, linkedin profile, portfolio

how many students (immediate seniors) got placed
what is minimum, maximum, and average package

what companies do come across placement drive so that we can target as per our interests and can do prepare for that specific companies