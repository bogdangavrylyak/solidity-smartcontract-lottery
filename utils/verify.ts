import { run } from 'hardhat';

const verify = async (contractAddress: string, args: any[]): Promise<void> => {
  console.log('Veryfying contract...');
  try {
    await run('verify:verify', {
      address: contractAddress,
      constructorArguments: args,
    });
  } catch (error: any) {
    console.log('error.msg: ', error?.message);
    if (error?.message.toLowerCase() === 'already verified') {
      console.log('already verified');
    } else {
      console.log('error: ', error);
    }
  }
};

export default verify;
