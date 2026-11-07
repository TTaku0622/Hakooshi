"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Globe2, Plane } from "lucide-react";
import { prefectureFlagColors } from "./prefecture-colors";
import type { TripStatus } from "./trip-data";

export const TICKET_WIDTH = 800;
export const TICKET_HEIGHT = 320;

type BoardingTicketProps = {
  ticketRef: RefObject<HTMLDivElement | null>;
  origin: string;
  destination: string;
  oshi: string;
  event: string;
  date: string;
  memory: string;
  photo: string;
  color: string;
  seed: number;
  originPath: string;
  destinationPath: string;
  status?: TripStatus;
};

function contrastingInk(hex: string) {


  const channels = hex.match(/[a-f\d]{2}/gi)!.map((value) => {


    const channel = parseInt(value, 16) / 255;


    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });


  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722 > 0.25
    ? "#142035"
    : "#ffffff";
}

function MemoryBarcode({ seed }: { seed: number; }) {


  return (
    <svg className="memoryBarcode" viewBox="0 0 160 34" aria-hidden="true">
      {Array.from({ length: 50 }, (_, index) => (
        <rect
          key={index}
          x={index * 3.2}
          y="0"
          width={((seed >>> (index % 24)) & 1) + 1}
          height={index % 9 === 0 ? 34 : 29}
          fill="currentColor"
        />
      ))}
    </svg>
  );
}

export function BoardingTicket({
  ticketRef, origin, destination, oshi, event, date, memory, photo, color,
  seed, originPath, destinationPath, status = "completed",
}: BoardingTicketProps) {


  const viewportRef = useRef<HTMLDivElement>(null);


  const [scale, setScale] = useState(1);


  const destinationColor = prefectureFlagColors[destination];


  const ticketNumber = `OJ${String(seed % 100000).padStart(5, "0")}`;


  const displayDate = date ? date.replaceAll("-", ".") : "日付未設定";


  const shortName = (name: string) => name.replace(/(都|府|県)$/, "");



  useEffect(() => {


    const viewport = viewportRef.current;


    if (!viewport) return;


    const observer = new ResizeObserver(([entry]) => {


      setScale(Math.min(1, entry.contentRect.width / TICKET_WIDTH));
    });


    observer.observe(viewport);


    return () => observer.disconnect();
  }, []);



  return (
    <div className="ticketStage">


      <div className="ticketViewport" ref={viewportRef}>


        <div className="ticket" ref={ticketRef} style={{ transform: `scale(${scale})` }}>


          <div
            className="ticketPaper"
            style={{ backgroundImage: `linear-gradient(110deg, ${color} 0%, ${destinationColor} 100%)` }}
          >


            <div className="boardingHeader">


              <div className="boardingHeaderMain" style={{ color: contrastingInk(color) }}>


                <span className="boardingBrand">

                  <Plane size={17} /> OSHI JOURNEY</span>


                <strong>BOARDING PASS</strong>


                <span className="boardingHeaderNote">YOUR MEMORY, YOUR TICKET.</span>


              </div>


              <div className="boardingHeaderStub" style={{ color: contrastingInk(destinationColor) }}>


                <strong>BOARDING PASS</strong>

                <Plane size={16} />


              </div>


            </div>



            <div className="boardingRail" style={{ color: contrastingInk(color) }}>


              <Plane size={23} />


              <span>ONE JOURNEY, ONE STORY</span>


              <Globe2 size={29} />


            </div>



            <div className="boardingMain">


              <div className="boardingTopline">

                <span>MY OSHI / MY JOURNEY</span>

                <span>{status === "planned" ? "NEXT JOURNEY / 遠征予定" : "MEMORY CLASS / 遠征済み"}</span>

              </div>


              <div className="boardingIdentity">


                <div className="boardingField">

                  <span>NAME OF ARTIST / OSHI</span>

                  <strong>{oshi || "推し未設定"}</strong>

                </div>


                <div className="boardingField boardingNumber">

                  <span>TICKET NO.</span>

                  <strong>{ticketNumber}</strong>

                </div>


              </div>


              <div className="boardingField boardingEvent">

                <span>EVENT / LIVE</span>

                <strong>{event || "イベント名未設定"}</strong>

              </div>


              <div className="boardingRoute">


                <div>

                  <span>FROM</span>

                  <strong>{shortName(origin)}</strong>

                </div>


                <div className="boardingFlightLine">

                  <i />

                  <Plane size={21} />

                  <i />

                </div>


                <div>

                  <span>TO</span>

                  <strong>{shortName(destination)}</strong>

                </div>


              </div>


              <div className="boardingDetails">


                <div className="boardingField boardingDate">

                  <span>DATE OF MEMORY</span>

                  <strong>{displayDate}</strong>

                </div>


                <div className="boardingField boardingMemory">

                  <span>YOUR MEMORY</span>

                  <p>{memory || "大切な思い出をここに。"}</p>

                </div>
                {photo ? (
                  <div className="boardingPhoto">

                    <img src={photo} alt="この日の思い出の写真" />

                  </div>
                ) : (
                  <div className="boardingMaps">


                    <svg viewBox="0 0 135 98" role="img" aria-label="出発地と目的地の地図">


                      <path d={originPath} transform="translate(0 2)" fill={color} fillOpacity="0.22" stroke="#334155" strokeWidth="0.7" fillRule="evenodd" />


                      <path d={destinationPath} transform="translate(76 2)" fill={destinationColor} fillOpacity="0.3" stroke="#334155" strokeWidth="0.7" fillRule="evenodd" />


                    </svg>


                    <small>FROM / TO</small>


                  </div>
                )}
              </div>


              <div className="boardingFootnote">

                <span>NOT VALID FOR TRAVEL OR ADMISSION</span>

                <span>KEEP THIS MEMORY FOREVER</span>

              </div>


            </div>



            <div className="boardingStub">


              <div className="boardingTopline">

                <span>OSHI JOURNEY</span>

                <span>MEMORY</span>

              </div>


              <div className="boardingField stubIdentity">

                <span>NAME OF ARTIST / OSHI</span>

                <strong>{oshi || "推し未設定"}</strong>

              </div>


              <div className="boardingField stubEvent">

                <span>EVENT / LIVE</span>

                <strong>{event || "イベント名未設定"}</strong>

              </div>


              <div className="stubRoute">

                <div>

                  <span>FROM</span>

                  <strong>{origin}</strong>

                </div>

                <div>

                  <span>TO</span>

                  <strong>{destination}</strong>

                </div>

              </div>


              <div className="stubDateRow">

                <div className="boardingField">

                  <span>DATE</span>

                  <strong>{displayDate}</strong>

                </div>

                <Plane size={20} />

              </div>


              <div className="stubBarcode">

                <MemoryBarcode seed={seed} />

                <small>MEMORY CODE · {ticketNumber}</small>

              </div>


              <div className="stubMessage">HAVE A NICE OSHI TRIP!</div>


            </div>


          </div>


        </div>


      </div>


    </div>
  );
}
