import asyncio
import logging
from pymodbus.server import StartAsyncTcpServer
from pymodbus.datastore import ModbusSequentialDataBlock
from pymodbus.datastore import ModbusDeviceContext, ModbusServerContext

logging.basicConfig()
log = logging.getLogger()
log.setLevel(logging.INFO)

async def run_server():
    store = ModbusDeviceContext(
        di=ModbusSequentialDataBlock(0, [0] * 100),
        co=ModbusSequentialDataBlock(0, [0] * 100),
        hr=ModbusSequentialDataBlock(0, [850, 350, 45] + [0] * 97), 
        ir=ModbusSequentialDataBlock(0, [0] * 100),
    )

    context = ModbusServerContext(slaves=store, single=True)

    log.info("Starting Modbus TCP Simulator on localhost:5020")
    
    await StartAsyncTcpServer(
        context=context,
        address=("127.0.0.1", 5020),
    )

if __name__ == "__main__":
    asyncio.run(run_server())
